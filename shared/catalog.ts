import type { SoundQuery } from './schemas/sound'

/** Réponse de `GET /api/sounds`, telle que la décrit docs/03-api.md. */
export interface CatalogTagRef {
  id: string
  name: string
  slug: string
}

export interface CatalogTag extends CatalogTagRef {
  soundCount: number
}

export interface CatalogSound {
  id: string
  name: string
  description: string | null
  url: string
  mimeType: string
  durationMs: number | null
  hotkey: string | null
  position: number
  tags: CatalogTagRef[]
}

export interface Catalog {
  sounds: CatalogSound[]
  tags: CatalogTag[]
}

/** Son vu de l'administration : le catalogue public, enrichi. */
export interface AdminSound extends CatalogSound {
  sizeBytes: number
  originalFilename: string
  createdAt: number
  updatedAt: number
  createdBy: { id: string, name: string | null } | null
}

/** Réponse de `GET /api/admin/sounds`. */
export interface AdminCatalog {
  sounds: AdminSound[]
  tags: CatalogTag[]
}

/** Forme comparable d'un texte : sans casse ni accents, « Brisé » vaut « brise ». */
export function foldForSearch(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
}

/**
 * Filtre du catalogue : la recherche porte sur le nom et la description, les
 * tags filtrent en intersection. Le serveur l'applique aux paramètres d'URL,
 * la board au jeu complet déjà chargé — un lien partagé donne ainsi le même
 * résultat des deux côtés.
 */
export function filterSounds<TSound extends CatalogSound>(sounds: TSound[], query: SoundQuery): TSound[] {
  const needle = query.q === undefined ? undefined : foldForSearch(query.q)

  return sounds.filter((sound) => {
    const slugs = new Set(sound.tags.map(tag => tag.slug))

    if (!query.tags.every(slug => slugs.has(slug))) {
      return false
    }

    return needle === undefined
      || foldForSearch(sound.name).includes(needle)
      || (sound.description !== null && foldForSearch(sound.description).includes(needle))
  })
}
