// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { soundTags, sounds, tags, users } from '../../../server/database/schema'
import type { DatabaseConnection } from '../../../server/database/client'
import { aSound, aTag, aUser, constraintCodeOf, createTestDatabase } from './helpers'

const UNIQUE = 'SQLITE_CONSTRAINT_UNIQUE'
const PRIMARY_KEY = 'SQLITE_CONSTRAINT_PRIMARYKEY'
const FOREIGN_KEY = 'SQLITE_CONSTRAINT_FOREIGNKEY'

describe('schéma de la base', () => {
  let connection: DatabaseConnection

  beforeEach(() => {
    connection = createTestDatabase()
  })

  afterEach(() => {
    connection.sqlite.close()
  })

  it('crée les quatre tables du modèle', () => {
    const names = connection.sqlite
      .prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name')
      .all('table')
      .map(row => (row as { name: string }).name)

    expect(names).toEqual(expect.arrayContaining(['users', 'sounds', 'tags', 'sound_tags']))
  })

  it('active les clés étrangères', () => {
    expect(connection.sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  describe('unicité', () => {
    it('refuse deux utilisateurs pour le même couple (issuer, subject)', () => {
      connection.db.insert(users).values(aUser()).run()

      const code = constraintCodeOf(() => {
        connection.db.insert(users).values(aUser({ subject: 'subject-1' })).run()
      })

      expect(code).toBe(UNIQUE)
    })

    it('accepte le même subject chez deux issuers différents', () => {
      connection.db.insert(users).values(aUser()).run()
      connection.db.insert(users).values(aUser({ issuer: 'https://autre.example.com' })).run()

      expect(connection.db.select().from(users).all()).toHaveLength(2)
    })

    it('refuse deux sons portant le même checksum', () => {
      connection.db.insert(sounds).values(aSound()).run()

      const code = constraintCodeOf(() => {
        connection.db.insert(sounds).values(aSound({ name: 'Autre' })).run()
      })

      expect(code).toBe(UNIQUE)
    })

    it('refuse deux sons sur le même raccourci', () => {
      connection.db.insert(sounds).values(aSound({ hotkey: 'a' })).run()

      const code = constraintCodeOf(() => {
        connection.db.insert(sounds).values(aSound({ checksum: 'b'.repeat(64), hotkey: 'a' })).run()
      })

      expect(code).toBe(UNIQUE)
    })

    it('accepte autant de sons sans raccourci que voulu', () => {
      connection.db.insert(sounds).values(aSound({ hotkey: null })).run()
      connection.db.insert(sounds).values(aSound({ checksum: 'b'.repeat(64), hotkey: null })).run()
      connection.db.insert(sounds).values(aSound({ checksum: 'c'.repeat(64), hotkey: null })).run()

      expect(connection.db.select().from(sounds).all()).toHaveLength(3)
    })

    it('refuse deux tags portant le même slug', () => {
      connection.db.insert(tags).values(aTag({ name: 'Blagues' })).run()

      const code = constraintCodeOf(() => {
        connection.db.insert(tags).values(aTag({ name: 'blagues' })).run()
      })

      expect(code).toBe(UNIQUE)
    })

    it('refuse deux fois la même association son / tag', () => {
      const sound = aSound()
      const tag = aTag()

      connection.db.insert(sounds).values(sound).run()
      connection.db.insert(tags).values(tag).run()
      connection.db.insert(soundTags).values({ soundId: sound.id, tagId: tag.id }).run()

      const code = constraintCodeOf(() => {
        connection.db.insert(soundTags).values({ soundId: sound.id, tagId: tag.id }).run()
      })

      expect(code).toBe(PRIMARY_KEY)
    })
  })

  describe('intégrité référentielle', () => {
    it('refuse une association vers un tag inexistant', () => {
      const sound = aSound()
      connection.db.insert(sounds).values(sound).run()

      const code = constraintCodeOf(() => {
        connection.db.insert(soundTags).values({ soundId: sound.id, tagId: 'inconnu' }).run()
      })

      expect(code).toBe(FOREIGN_KEY)
    })

    it('conserve le son quand son auteur est supprimé', () => {
      const user = aUser()
      const sound = aSound({ createdBy: user.id })

      connection.db.insert(users).values(user).run()
      connection.db.insert(sounds).values(sound).run()
      connection.db.delete(users).where(eq(users.id, user.id)).run()

      const stored = connection.db.select().from(sounds).all()

      expect(stored).toHaveLength(1)
      expect(stored[0]?.createdBy).toBeNull()
    })

    it('supprime les associations quand le son disparaît', () => {
      const sound = aSound()
      const tag = aTag()

      connection.db.insert(sounds).values(sound).run()
      connection.db.insert(tags).values(tag).run()
      connection.db.insert(soundTags).values({ soundId: sound.id, tagId: tag.id }).run()
      connection.db.delete(sounds).where(eq(sounds.id, sound.id)).run()

      expect(connection.db.select().from(soundTags).all()).toHaveLength(0)
      expect(connection.db.select().from(tags).all()).toHaveLength(1)
    })
  })

  it('donne le rôle « user » par défaut', () => {
    connection.db
      .insert(users)
      .values({ id: 'u1', issuer: 'https://auth.example.com', subject: 's1', createdAt: 0 })
      .run()

    expect(connection.db.select().from(users).all()[0]?.role).toBe('user')
  })
})
