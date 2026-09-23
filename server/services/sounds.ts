import { eq, inArray, max } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { InferOutput } from 'valibot'
import type { AdminCatalog, AdminSound } from '#shared/catalog'
import { SoundCreateSchema } from '#shared/schemas/sound'
import type { SoundUpdateSchema } from '#shared/schemas/sound'
import { slugify } from '#shared/schemas/tag'
import type { Database } from '../database/client'
import { soundTags, sounds, tags, users } from '../database/schema'
import { listTags, loadSounds, toCatalogSound } from './catalog'
import type { SoundWithTags } from './catalog'
import type { MediaFile, MediaStorage, ReceivedFile } from './storage'
import type { AudioExtension } from '../utils/file-type'
import { ApiError } from '../utils/errors'
import { parseInput } from '../utils/validation'

/** Écart entre deux positions : de quoi réinsérer sans tout renuméroter. */
export const POSITION_STEP = 1000

/** Le nom d'origine n'est qu'informatif : il est borné, jamais interprété. */
const ORIGINAL_FILENAME_MAX_LENGTH = 255

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type SoundUpdate = InferOutput<typeof SoundUpdateSchema>

export interface NewSoundUpload {
  file: ReceivedFile
  originalFilename: string | null
  /** Champs texte bruts du multipart, validés ici par `SoundCreateSchema`. */
  fields: Record<string, string>
  createdBy: string | null
}

function toAdminSound(row: SoundWithTags, authors: Map<string, string | null>): AdminSound {
  return {
    ...toCatalogSound(row),
    sizeBytes: row.sizeBytes,
    originalFilename: row.originalFilename,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy === null ? null : { id: row.createdBy, name: authors.get(row.createdBy) ?? null },
  }
}

function authorsOf(db: Database, rows: SoundWithTags[]): Map<string, string | null> {
  const ids = [...new Set(rows.map(row => row.createdBy).filter(id => id !== null))]

  if (ids.length === 0) {
    return new Map()
  }

  const found = db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)).all()

  return new Map(found.map(user => [user.id, user.name]))
}

export async function getAdminCatalog(db: Database): Promise<AdminCatalog> {
  const rows = await loadSounds(db)
  const authors = authorsOf(db, rows)

  return { sounds: rows.map(row => toAdminSound(row, authors)), tags: listTags(db) }
}

async function getAdminSound(db: Database, id: string): Promise<AdminSound> {
  const [row] = await loadSounds(db, id)

  if (!row) {
    throw new ApiError('not_found')
  }

  return toAdminSound(row, authorsOf(db, [row]))
}

function soundWithChecksum(db: Database | Transaction, checksum: string) {
  return db.select({ id: sounds.id }).from(sounds).where(eq(sounds.checksum, checksum)).get()
}

/** Refuse un raccourci déjà porté par un autre son que `exceptId`. */
function assertHotkeyFree(db: Database | Transaction, hotkey: string | null | undefined, exceptId?: string) {
  if (!hotkey) {
    return
  }

  const owner = db.select({ id: sounds.id }).from(sounds).where(eq(sounds.hotkey, hotkey)).get()

  if (owner && owner.id !== exceptId) {
    throw new ApiError('hotkey_taken', { details: { soundId: owner.id } })
  }
}

/** Identifiants des tags nommés, créés au passage quand leur slug est inconnu. */
function ensureTags(tx: Transaction, names: string[], now: number): string[] {
  return names.map((name) => {
    const slug = slugify(name)
    const existing = tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get()

    if (existing) {
      return existing.id
    }

    const id = uuidv7()

    tx.insert(tags).values({ id, name, slug, createdAt: now }).run()

    return id
  })
}

function setTags(tx: Transaction, soundId: string, names: string[], now: number) {
  tx.delete(soundTags).where(eq(soundTags.soundId, soundId)).run()

  const tagIds = ensureTags(tx, names, now)

  if (tagIds.length > 0) {
    tx.insert(soundTags).values(tagIds.map(tagId => ({ soundId, tagId }))).run()
  }
}

/** Une violation d'unicité SQLite, et la colonne en cause. */
function uniqueViolation(error: unknown): string | null {
  const { code, message } = error as { code?: string, message?: string }

  return code === 'SQLITE_CONSTRAINT_UNIQUE' ? /sounds\.(\w+)/.exec(message ?? '')?.[1] ?? null : null
}

/**
 * Crée un son à partir d'un fichier reçu, dans l'ordre de docs/03-api.md :
 * type réel, champs, unicité du checksum puis du raccourci, et enfin
 * publication du fichier et insertion. Le fichier temporaire ne survit à
 * aucun échec.
 */
export async function createSound(
  db: Database,
  storage: Pick<MediaStorage, 'commit' | 'discard' | 'remove'>,
  upload: NewSoundUpload,
  now: number = Date.now(),
): Promise<AdminSound> {
  const { file } = upload
  let published: MediaFile | undefined

  try {
    if (!file.type) {
      throw new ApiError('unsupported_media_type')
    }

    const fields = parseInput(SoundCreateSchema, upload.fields)
    const duplicate = soundWithChecksum(db, file.checksum)

    if (duplicate) {
      throw new ApiError('duplicate_sound', { details: { soundId: duplicate.id } })
    }

    assertHotkeyFree(db, fields.hotkey)

    published = await storage.commit(file)

    const id = uuidv7()
    const extension = published.extension

    db.transaction((tx) => {
      const { last } = tx.select({ last: max(sounds.position) }).from(sounds).get() ?? { last: null }

      tx.insert(sounds).values({
        id,
        name: fields.name,
        description: fields.description,
        checksum: file.checksum,
        extension,
        mimeType: file.type!.mimeType,
        sizeBytes: file.sizeBytes,
        durationMs: fields.durationMs,
        originalFilename: (upload.originalFilename ?? `upload.${extension}`).slice(0, ORIGINAL_FILENAME_MAX_LENGTH),
        hotkey: fields.hotkey,
        position: (last ?? 0) + POSITION_STEP,
        createdBy: upload.createdBy,
        createdAt: now,
        updatedAt: now,
      }).run()

      setTags(tx, id, fields.tags, now)
    }, { behavior: 'immediate' })

    return await getAdminSound(db, id)
  }
  catch (error) {
    if (!published) {
      await storage.discard(file)
    }
    // Publié mais pas inséré : le fichier n'est retiré que si aucun son ne le
    // désigne — un upload concurrent du même contenu a pu l'emporter.
    else if (!soundWithChecksum(db, published.checksum)) {
      await storage.remove(published)
    }

    throw conflictOf(error, db, file.checksum, upload.fields.hotkey)
  }
}

/**
 * Une course perdue contre une écriture concurrente passe les contrôles
 * préalables mais bute sur l'index unique : elle reçoit le même `409`.
 */
function conflictOf(error: unknown, db: Database, checksum: string, hotkey: string | undefined): unknown {
  const column = uniqueViolation(error)

  if (column === 'checksum') {
    return new ApiError('duplicate_sound', { details: { soundId: soundWithChecksum(db, checksum)?.id } })
  }

  if (column === 'hotkey') {
    const owner = db.select({ id: sounds.id }).from(sounds).where(eq(sounds.hotkey, hotkey?.trim().toLowerCase() ?? '')).get()

    return new ApiError('hotkey_taken', { details: { soundId: owner?.id } })
  }

  return error
}

/** Édition partielle : un champ absent est conservé, les tags sont remplacés en bloc. */
export async function updateSound(db: Database, id: string, patch: SoundUpdate, now: number = Date.now()): Promise<AdminSound> {
  const current = db.select({ id: sounds.id }).from(sounds).where(eq(sounds.id, id)).get()

  if (!current) {
    throw new ApiError('not_found')
  }

  assertHotkeyFree(db, patch.hotkey, id)

  try {
    db.transaction((tx) => {
      tx.update(sounds).set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.hotkey !== undefined && { hotkey: patch.hotkey }),
        updatedAt: now,
      }).where(eq(sounds.id, id)).run()

      if (patch.tags !== undefined) {
        setTags(tx, id, patch.tags, now)
      }
    }, { behavior: 'immediate' })
  }
  catch (error) {
    throw uniqueViolation(error) === 'hotkey' ? new ApiError('hotkey_taken') : error
  }

  return getAdminSound(db, id)
}

/** Supprime la ligne, puis le fichier : un fichier orphelin vaut mieux qu'un son sans fichier. */
export async function deleteSound(db: Database, storage: Pick<MediaStorage, 'remove'>, id: string): Promise<void> {
  const row = db.select().from(sounds).where(eq(sounds.id, id)).get()

  if (!row) {
    throw new ApiError('not_found')
  }

  db.delete(sounds).where(eq(sounds.id, id)).run()

  await storage.remove({ checksum: row.checksum, extension: row.extension as AudioExtension })
}

/**
 * Nouvel ordre complet : la liste doit contenir exactement tous les sons.
 * Les positions sont réattribuées par pas de 1000, d'un bloc.
 */
export function reorderSounds(db: Database, ids: string[]): void {
  db.transaction((tx) => {
    const existing = new Set(tx.select({ id: sounds.id }).from(sounds).all().map(row => row.id))

    if (ids.length !== existing.size || ids.some(id => !existing.has(id))) {
      throw new ApiError('validation_failed', { issues: [{ path: 'ids', code: 'invalid_value' }] })
    }

    ids.forEach((id, index) => {
      tx.update(sounds).set({ position: (index + 1) * POSITION_STEP }).where(eq(sounds.id, id)).run()
    })
  }, { behavior: 'immediate' })
}
