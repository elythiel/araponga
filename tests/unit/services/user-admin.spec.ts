// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseConnection } from '../../../server/database/client'
import { sounds, users } from '../../../server/database/schema'
import { deleteUser, listUsers, setUserRole } from '../../../server/services/users'
import { aSound, aUser, createTestDatabase } from '../database/helpers'

describe('administration des comptes', () => {
  let connection: DatabaseConnection

  beforeEach(() => {
    connection = createTestDatabase()
  })

  afterEach(() => {
    connection.sqlite.close()
  })

  function insert(role: 'admin' | 'user', createdAt: number) {
    const user = aUser({ subject: `s-${createdAt}`, role, createdAt, name: `Compte ${createdAt}` })

    connection.db.insert(users).values(user).run()

    return user
  }

  it('liste les comptes par date de création, sans émetteur ni sub', () => {
    const second = insert('user', 2000)
    const first = insert('admin', 1000)

    const listed = listUsers(connection.db)

    expect(listed.map(user => user.id)).toEqual([first.id, second.id])
    expect(listed[0]).toStrictEqual({
      id: first.id,
      name: 'Compte 1000',
      email: null,
      role: 'admin',
      createdAt: 1000,
      lastLoginAt: null,
    })
  })

  describe('bascule de rôle', () => {
    it('promeut un user et rétrograde un autre admin', () => {
      const actor = insert('admin', 1000)
      const other = insert('user', 2000)

      expect(setUserRole(connection.db, actor.id, other.id, 'admin').role).toBe('admin')
      expect(setUserRole(connection.db, actor.id, other.id, 'user').role).toBe('user')
    })

    it('refuse de se rétrograder soi-même en 403, même avec d\'autres admins', () => {
      const actor = insert('admin', 1000)

      insert('admin', 2000)

      expect(() => setUserRole(connection.db, actor.id, actor.id, 'user'))
        .toThrow(expect.objectContaining({ statusCode: 403, code: 'self_demotion' }))
    })

    it('refuse de rétrograder le dernier administrateur en 409', () => {
      // Seul admin, rétrogradé par un compte dont le rôle vient de tomber :
      // le décompte en base fait foi, pas le rôle de l'auteur.
      const actor = insert('user', 1000)
      const lastAdmin = insert('admin', 2000)

      expect(() => setUserRole(connection.db, actor.id, lastAdmin.id, 'user'))
        .toThrow(expect.objectContaining({ statusCode: 409, code: 'last_admin' }))
    })

    it('laisse passer un rôle inchangé', () => {
      const actor = insert('admin', 1000)

      expect(setUserRole(connection.db, actor.id, actor.id, 'admin').role).toBe('admin')
    })

    it('répond 404 pour un compte inconnu', () => {
      const actor = insert('admin', 1000)

      expect(() => setUserRole(connection.db, actor.id, crypto.randomUUID(), 'admin'))
        .toThrow(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('suppression', () => {
    it('supprime un compte en gardant ses sons', () => {
      insert('admin', 1000)

      const author = insert('user', 2000)

      connection.db.insert(sounds).values(aSound({ createdBy: author.id })).run()
      deleteUser(connection.db, author.id)

      expect(listUsers(connection.db)).toHaveLength(1)
      expect(connection.db.select().from(sounds).get()?.createdBy).toBeNull()
    })

    it('refuse de supprimer le dernier administrateur en 409', () => {
      const lastAdmin = insert('admin', 1000)

      insert('user', 2000)

      expect(() => deleteUser(connection.db, lastAdmin.id))
        .toThrow(expect.objectContaining({ statusCode: 409, code: 'last_admin' }))
    })

    it('supprime un administrateur quand il en reste un autre', () => {
      insert('admin', 1000)

      const second = insert('admin', 2000)

      deleteUser(connection.db, second.id)

      expect(listUsers(connection.db).map(user => user.role)).toEqual(['admin'])
    })
  })
})
