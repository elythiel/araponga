import { asc, count, eq } from 'drizzle-orm'
import { filterSounds } from '#shared/catalog'
import type { Catalog, CatalogSound } from '#shared/catalog'
import type { SoundQuery } from '#shared/schemas/sound'
import type { Database } from '../database/client'
import { soundTags, sounds, tags } from '../database/schema'
import { mediaUrl } from './storage'
import type { AudioExtension } from '../utils/file-type'

const bySlug = (a: { slug: string }, b: { slug: string }) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)

/**
 * Catalogue public : les sons dans l'ordre d'affichage, filtrés par la
 * requête, et **tous** les tags avec leur nombre de sons — la liste des
 * filtres ne dépend pas du filtre en cours. Tout est chargé puis filtré en
 * mémoire : l'insensibilité aux accents n'est pas exprimable en SQLite, et
 * le volume visé (500 sons) ne le justifie pas.
 */
export async function getCatalog(db: Database, query: SoundQuery): Promise<Catalog> {
  const rows = await db.query.sounds.findMany({
    // `position` n'est pas unique : l'identifiant, chronologique, départage.
    orderBy: [asc(sounds.position), asc(sounds.id)],
    with: { soundTags: { with: { tag: true } } },
  })

  const catalogSounds: CatalogSound[] = rows.map(row => ({
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
  }))

  const catalogTags = db
    .select({ id: tags.id, name: tags.name, slug: tags.slug, soundCount: count(soundTags.soundId) })
    .from(tags)
    .leftJoin(soundTags, eq(soundTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.slug))
    .all()

  return { sounds: filterSounds(catalogSounds, query), tags: catalogTags }
}
