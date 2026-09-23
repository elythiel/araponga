import { and, count, eq, ne } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { CatalogTag } from '#shared/catalog'
import { slugify } from '#shared/schemas/tag'
import type { Database } from '../database/client'
import { soundTags, tags } from '../database/schema'
import { ApiError } from '../utils/errors'
import { listTags } from './catalog'

export { listTags }

function soundCountOf(db: Database, id: string): number {
  return db.select({ total: count() }).from(soundTags).where(eq(soundTags.tagId, id)).get()?.total ?? 0
}

function toCatalogTag(db: Database, id: string): CatalogTag {
  const tag = db.select().from(tags).where(eq(tags.id, id)).get()

  if (!tag) {
    throw new ApiError('not_found')
  }

  return { id: tag.id, name: tag.name, slug: tag.slug, soundCount: soundCountOf(db, tag.id) }
}

/**
 * Crée un tag, ou renvoie celui qui porte déjà ce slug : « Blagues » et
 * « blagues » sont le même tag, le recréer n'est pas une erreur.
 */
export function createTag(db: Database, name: string, now: number = Date.now()): { tag: CatalogTag, created: boolean } {
  const slug = slugify(name)
  const existing = db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get()

  if (existing) {
    return { tag: toCatalogTag(db, existing.id), created: false }
  }

  const id = uuidv7()

  db.insert(tags).values({ id, name, slug, createdAt: now }).run()

  return { tag: toCatalogTag(db, id), created: true }
}

/** Renommage ; un slug déjà porté par un autre tag est un conflit. */
export function renameTag(db: Database, id: string, name: string): CatalogTag {
  const slug = slugify(name)

  if (!db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).get()) {
    throw new ApiError('not_found')
  }

  const other = db.select({ id: tags.id }).from(tags).where(and(eq(tags.slug, slug), ne(tags.id, id))).get()

  if (other) {
    throw new ApiError('tag_in_use', { details: { tagId: other.id } })
  }

  db.update(tags).set({ name, slug }).where(eq(tags.id, id)).run()

  return toCatalogTag(db, id)
}

/**
 * Un tag encore rattaché à des sons n'est supprimé qu'avec `force` : il en
 * est alors détaché, dans la même transaction.
 */
export function deleteTag(db: Database, id: string, force: boolean): void {
  db.transaction((tx) => {
    if (!tx.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).get()) {
      throw new ApiError('not_found')
    }

    const soundCount = tx.select({ total: count() }).from(soundTags).where(eq(soundTags.tagId, id)).get()?.total ?? 0

    if (soundCount > 0 && !force) {
      throw new ApiError('tag_in_use', { details: { soundCount } })
    }

    tx.delete(soundTags).where(eq(soundTags.tagId, id)).run()
    tx.delete(tags).where(eq(tags.id, id)).run()
  }, { behavior: 'immediate' })
}
