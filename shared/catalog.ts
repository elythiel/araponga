import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import type { SoundQuery } from './schemas/sound'
import type { UserRole } from './schemas/user'

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

/** Compte vu de l'administration : jamais l'émetteur ni le `sub`. */
export interface AdminUser {
  id: string
  name: string | null
  email: string | null
  role: UserRole
  createdAt: number
  lastLoginAt: number | null
}

/** Réponse de `GET /api/admin/sounds`. */
export interface AdminCatalog {
  sounds: AdminSound[]
  tags: CatalogTag[]
}

/**
 * Réglage de la recherche floue. `ignoreLocation` : la correspondance peut
 * être n'importe où dans le texte, pas seulement au début. Le seuil (0 exact,
 * 1 tout passe) est un point de départ, à ajuster sur de vrais noms.
 */
const SEARCH_OPTIONS: IFuseOptions<CatalogSound> = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'tags.name', weight: 1 },
    { name: 'description', weight: 1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  ignoreDiacritics: true,
}

/**
 * Filtre du catalogue, seul et même partout : la board, l'administration et
 * `GET /api/sounds?q=` trouvent les mêmes sons pour une même requête.
 *
 * Les tags filtrent en intersection ; la recherche est floue, sans casse ni
 * accents, sur le nom, les noms de tags et la description. Sans recherche,
 * l'ordre reçu est conservé ; avec, les meilleurs résultats viennent d'abord.
 */
export function filterSounds<TSound extends CatalogSound>(sounds: TSound[], query: SoundQuery): TSound[] {
  const tagged = query.tags.length === 0
    ? sounds
    : sounds.filter((sound) => {
        const slugs = new Set(sound.tags.map(tag => tag.slug))

        return query.tags.every(slug => slugs.has(slug))
      })

  if (!query.q) {
    return tagged
  }

  return new Fuse(tagged, SEARCH_OPTIONS as IFuseOptions<TSound>).search(query.q).map(result => result.item)
}
