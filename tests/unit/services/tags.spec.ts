// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseConnection } from '../../../server/database/client'
import { soundTags, sounds, tags } from '../../../server/database/schema'
import { createTag, deleteTag, listTags, renameTag } from '../../../server/services/tags'
import { aSound, aTag, createTestDatabase } from '../database/helpers'

describe('service des tags', () => {
  let connection: DatabaseConnection

  beforeEach(() => {
    connection = createTestDatabase()
  })

  afterEach(() => {
    connection.sqlite.close()
  })

  /** Un tag rattaché à `count` sons. */
  function aTagOn(count: number, overrides: Record<string, unknown> = {}) {
    const tag = aTag(overrides)

    connection.db.insert(tags).values(tag).run()

    for (let index = 0; index < count; index++) {
      const sound = aSound({ checksum: `${tag.slug}${index}`.padEnd(64, '0'), position: index })

      connection.db.insert(sounds).values(sound).run()
      connection.db.insert(soundTags).values({ soundId: sound.id, tagId: tag.id }).run()
    }

    return tag
  }

  describe('création', () => {
    it('crée un tag avec son slug', () => {
      const { tag, created } = createTag(connection.db, 'Jeux vidéo')

      expect(created).toBe(true)
      expect(tag).toMatchObject({ name: 'Jeux vidéo', slug: 'jeux-video', soundCount: 0 })
    })

    it('renvoie le tag existant quand le slug est déjà pris, sans le modifier', () => {
      const existing = aTagOn(2, { name: 'Blagues', slug: 'blagues' })

      const { tag, created } = createTag(connection.db, 'BLAGUES')

      expect(created).toBe(false)
      expect(tag).toStrictEqual({ id: existing.id, name: 'Blagues', slug: 'blagues', soundCount: 2 })
      expect(listTags(connection.db)).toHaveLength(1)
    })
  })

  describe('renommage', () => {
    it('renomme et recalcule le slug', () => {
      const tag = aTagOn(0)

      expect(renameTag(connection.db, tag.id, 'Humour noir')).toMatchObject({ name: 'Humour noir', slug: 'humour-noir' })
    })

    it('accepte un changement de casse, qui garde le même slug', () => {
      const tag = aTagOn(0, { name: 'blagues', slug: 'blagues' })

      expect(renameTag(connection.db, tag.id, 'Blagues').name).toBe('Blagues')
    })

    it('refuse en 409 un slug déjà porté par un autre tag', () => {
      const other = aTagOn(0, { name: 'Cinéma', slug: 'cinema' })
      const tag = aTagOn(0)

      expect(() => renameTag(connection.db, tag.id, 'cinema'))
        .toThrow(expect.objectContaining({ statusCode: 409, code: 'tag_in_use', details: { tagId: other.id } }))
    })

    it('répond 404 pour un tag inconnu', () => {
      expect(() => renameTag(connection.db, crypto.randomUUID(), 'x')).toThrow(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('suppression', () => {
    it('supprime un tag orphelin', () => {
      const tag = aTagOn(0)

      deleteTag(connection.db, tag.id, false)

      expect(listTags(connection.db)).toEqual([])
    })

    it('refuse en 409 un tag utilisé, en donnant le nombre de sons', () => {
      const tag = aTagOn(3)

      expect(() => deleteTag(connection.db, tag.id, false))
        .toThrow(expect.objectContaining({ statusCode: 409, code: 'tag_in_use', details: { soundCount: 3 } }))
      expect(listTags(connection.db)).toHaveLength(1)
    })

    it('avec force, détache le tag des sons puis le supprime, sans toucher aux sons', () => {
      const tag = aTagOn(3)

      deleteTag(connection.db, tag.id, true)

      expect(listTags(connection.db)).toEqual([])
      expect(connection.db.select().from(soundTags).all()).toEqual([])
      expect(connection.db.select().from(sounds).all()).toHaveLength(3)
    })

    it('répond 404 pour un tag inconnu', () => {
      expect(() => deleteTag(connection.db, crypto.randomUUID(), true)).toThrow(expect.objectContaining({ statusCode: 404 }))
    })
  })
})
