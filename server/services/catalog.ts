import { asc, count, eq } from 'drizzle-orm'
import { filterSounds } from '#shared/catalog'
import type { Catalog, CatalogSound, CatalogTag } from '#shared/catalog'
import type { SoundQuery } from '#shared/schemas/sound'
import type { Database } from '../database/client'
import { soundTags, sounds, tags } from '../database/schema'
import type { Sound, Tag } from '../database/schema'
import { mediaUrl } from './storage'
import type { AudioExtension } from '../utils/file-type'

const bySlug = (a: { slug: string }, b: { slug: string }) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)

export type SoundWithTags = Sound & { soundTags: Array<{ tag: Tag }> }

/** Les sons dans l'ordre d'affichage, avec leurs tags. */
export function loadSounds(db: Database, id?: string): Promise<SoundWithTags[]> {
  return db.query.sounds.findMany({
    ...(id && { where: eq(sounds.id, id) }),
    // `position` n'est pas unique : l'identifiant, chronologique, départage.
    orderBy: [asc(sounds.position), asc(sounds.id)],
    with: { soundTags: { with: { tag: true } } },
  })
}

export function toCatalogSound(row: SoundWithTags): CatalogSound {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    url: mediaUrl({ checksum: row.checksum, extension: row.extension as AudioExtension }),
    mimeType: row.mimeType,
    durationMs: row.durationMs,
    hotkey: row.hotkey,
    position: row.position,
    tags: row.soundTags
      .map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug }))
      .sort(bySlug),
  }
}

/** Tous les tags, orphelins compris, avec leur nombre de sons. */
export function listTags(db: Database): CatalogTag[] {
  return db
    .select({ id: tags.id, name: tags.name, slug: tags.slug, soundCount: count(soundTags.soundId) })
    .from(tags)
    .leftJoin(soundTags, eq(soundTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.slug))
    .all()
}

/**
 * Catalogue public : les sons dans l'ordre d'affichage, filtrés par la
 * requête, et **tous** les tags avec leur nombre de sons — la liste des
 * filtres ne dépend pas du filtre en cours. Tout est chargé puis filtré en
 * mémoire : l'insensibilité aux accents n'est pas exprimable en SQLite, et
 * le volume visé (500 sons) ne le justifie pas.
 */
export async function getCatalog(db: Database, query: SoundQuery): Promise<Catalog> {
  const catalogSounds = (await loadSounds(db)).map(toCatalogSound)

  return { sounds: filterSounds(catalogSounds, query), tags: listTags(db) }
}
