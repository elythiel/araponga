// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseConnection } from '../../../server/database/client'
import { sounds, tags } from '../../../server/database/schema'
import { createSound, deleteSound, getAdminCatalog, reorderSounds, updateSound } from '../../../server/services/sounds'
import { createMediaStorage, parseMediaFilename } from '../../../server/services/storage'
import type { MediaStorage } from '../../../server/services/storage'
import { createTestDatabase } from '../database/helpers'
import { HEADERS, audioFile } from '../server/audio-fixtures'

/** Fichier désigné par l'URL publique d'un son. */
function fileOf(url: string) {
  return parseMediaFilename(url.replace('/media/', ''))!
}

describe('service des sons', () => {
  let connection: DatabaseConnection
  let dataDir: string
  let storage: MediaStorage
  let uploads = 0

  const tmpEntries = () => readdir(join(dataDir, 'media', '.tmp'))
  const rowCount = () => connection.db.select().from(sounds).all().length

  /** Un fichier reçu, distinct à chaque appel sauf `content` imposé. */
  async function received(content: Uint8Array = audioFile(HEADERS.mp3Id3, 1000 + uploads++)) {
    return storage.receive((async function* () {
      yield content
    })())
  }

  async function upload(fields: Record<string, string> = {}, content?: Uint8Array) {
    return createSound(connection.db, storage, {
      file: await received(content),
      originalFilename: 'tada.mp3',
      fields: { name: 'Tada', ...fields },
      createdBy: null,
    }, 1_700_000_000_000)
  }

  beforeEach(async () => {
    connection = createTestDatabase()
    dataDir = await mkdtemp(join(tmpdir(), 'araponga-sounds-'))
    storage = createMediaStorage(dataDir)
  })

  afterEach(async () => {
    connection.sqlite.close()
    await rm(dataDir, { recursive: true, force: true })
  })

  describe('création', () => {
    it('publie le fichier, insère le son et renvoie sa forme d\'administration', async () => {
      const sound = await upload({ description: 'Ba dum tss', hotkey: 'T', durationMs: '1420', tags: '["Blagues", "Cinéma"]' })

      expect(sound).toMatchObject({
        name: 'Tada',
        description: 'Ba dum tss',
        mimeType: 'audio/mpeg',
        hotkey: 't',
        durationMs: 1420,
        position: 1000,
        originalFilename: 'tada.mp3',
        createdBy: null,
        tags: [{ name: 'Blagues', slug: 'blagues' }, { name: 'Cinéma', slug: 'cinema' }],
      })
      expect(sound.url).toMatch(/^\/media\/[0-9a-f]{64}\.mp3$/)
      expect(await storage.locate(fileOf(sound.url))).toMatchObject({ sizeBytes: sound.sizeBytes })
      expect(await tmpEntries()).toEqual([])
    })

    it('place chaque nouveau son après les autres', async () => {
      await upload()

      expect((await upload()).position).toBe(2000)
    })

    it('réutilise un tag existant d\'après son slug, crée les inconnus', async () => {
      await upload({ tags: '["Jeux vidéo"]' })
      await upload({ tags: '["jeux video", "Nouveau"]' })

      expect(connection.db.select().from(tags).all().map(tag => tag.name).sort()).toEqual(['Jeux vidéo', 'Nouveau'])
    })

    it('refuse en 415 un fichier dont la signature n\'est pas audio', async () => {
      await expect(upload({}, audioFile(HEADERS.zip))).rejects.toMatchObject({ statusCode: 415, code: 'unsupported_media_type' })
      expect(rowCount()).toBe(0)
      expect(await tmpEntries()).toEqual([])
    })

    it('refuse en 422 des champs invalides, sans rien laisser', async () => {
      await expect(upload({ name: '', hotkey: 'F13' })).rejects.toMatchObject({
        statusCode: 422,
        issues: [{ path: 'name', code: 'required' }, { path: 'hotkey', code: 'invalid_value' }],
      })
      expect(rowCount()).toBe(0)
      expect(await tmpEntries()).toEqual([])
    })

    it('refuse un doublon en 409, en désignant le son existant, sans toucher à son fichier', async () => {
      const content = audioFile(HEADERS.ogg)
      const existing = await upload({}, content)

      await expect(upload({ name: 'Copie' }, content)).rejects.toMatchObject({
        statusCode: 409,
        code: 'duplicate_sound',
        details: { soundId: existing.id },
      })
      expect(rowCount()).toBe(1)
      expect(await tmpEntries()).toEqual([])
      expect(await storage.locate(fileOf(existing.url))).not.toBeNull()
    })

    it('refuse un raccourci déjà pris en 409, en désignant le son qui le porte', async () => {
      const existing = await upload({ hotkey: 'a' })

      await expect(upload({ hotkey: 'A' })).rejects.toMatchObject({
        statusCode: 409,
        code: 'hotkey_taken',
        details: { soundId: existing.id },
      })
      expect(rowCount()).toBe(1)
      expect(await tmpEntries()).toEqual([])
    })
  })

  describe('édition', () => {
    it('ne change que les champs fournis et remplace les tags en bloc', async () => {
      const sound = await upload({ description: 'garde', tags: '["Blagues"]' })

      const updated = await updateSound(connection.db, sound.id, { name: 'Renommé', tags: ['Cinéma'] }, 1_800_000_000_000)

      expect(updated).toMatchObject({
        name: 'Renommé',
        description: 'garde',
        updatedAt: 1_800_000_000_000,
        tags: [{ slug: 'cinema' }],
      })
    })

    it('efface la description et le raccourci avec null', async () => {
      const sound = await upload({ description: 'x', hotkey: 'b' })

      expect(await updateSound(connection.db, sound.id, { description: null, hotkey: null }))
        .toMatchObject({ description: null, hotkey: null })
    })

    it('garde son propre raccourci, refuse celui d\'un autre', async () => {
      const first = await upload({ hotkey: 'a' })
      const second = await upload({ hotkey: 'b' })

      await expect(updateSound(connection.db, first.id, { hotkey: 'a' })).resolves.toMatchObject({ hotkey: 'a' })
      await expect(updateSound(connection.db, second.id, { hotkey: 'a' }))
        .rejects.toMatchObject({ statusCode: 409, code: 'hotkey_taken', details: { soundId: first.id } })
    })

    it('répond 404 pour un son inconnu', async () => {
      await expect(updateSound(connection.db, crypto.randomUUID(), { name: 'x' })).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('suppression', () => {
    it('supprime la ligne et le fichier', async () => {
      const sound = await upload()
      const file = fileOf(sound.url)

      await deleteSound(connection.db, storage, sound.id)

      expect(rowCount()).toBe(0)
      expect(await storage.locate(file)).toBeNull()
      await expect(deleteSound(connection.db, storage, sound.id)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('réordonnancement', () => {
    it('réattribue les positions par pas de 1000 dans l\'ordre donné', async () => {
      const [a, b, c] = [await upload(), await upload(), await upload()]

      reorderSounds(connection.db, [c!.id, a!.id, b!.id])

      const catalog = await getAdminCatalog(connection.db)

      expect(catalog.sounds.map(sound => [sound.id, sound.position])).toEqual([
        [c!.id, 1000],
        [a!.id, 2000],
        [b!.id, 3000],
      ])
    })

    it.each([
      ['incomplète', (ids: string[]) => ids.slice(1)],
      ['avec un intrus', (ids: string[]) => [...ids.slice(1), crypto.randomUUID()]],
    ])('refuse en 422 une liste %s', async (_, alter) => {
      const ids = [(await upload()).id, (await upload()).id]

      expect(() => reorderSounds(connection.db, alter(ids))).toThrow(expect.objectContaining({
        statusCode: 422,
        issues: [{ path: 'ids', code: 'invalid_value' }],
      }))
    })
  })
})
