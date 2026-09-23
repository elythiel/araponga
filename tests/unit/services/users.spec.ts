// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseConnection } from '../../../server/database/client'
import { users } from '../../../server/database/schema'
import { DEV_BYPASS_IDENTITY, findUser, recordDevBypassLogin, recordLogin } from '../../../server/services/users'
import { createTestDatabase } from '../database/helpers'

function anIdentity(subject: string, overrides: Record<string, unknown> = {}) {
  return { issuer: 'https://auth.example.com', subject, email: null, name: null, ...overrides }
}

describe('recordLogin', () => {
  let connection: DatabaseConnection

  beforeEach(() => {
    connection = createTestDatabase()
  })

  afterEach(() => {
    connection.sqlite.close()
  })

  it('fait du premier compte d\'une base vierge un admin, du second un user', () => {
    const first = recordLogin(connection.db, anIdentity('alice'), 1000)
    const second = recordLogin(connection.db, anIdentity('bob'), 2000)

    expect(first).toMatchObject({ subject: 'alice', role: 'admin', createdAt: 1000, lastLoginAt: 1000 })
    expect(second).toMatchObject({ subject: 'bob', role: 'user' })
  })

  it('retrouve un compte existant, met à jour son profil sans toucher à son rôle', () => {
    const created = recordLogin(connection.db, anIdentity('alice', { email: 'a@example.com' }), 1000)

    recordLogin(connection.db, anIdentity('bob'), 1500)

    const again = recordLogin(connection.db, anIdentity('alice', { email: 'alice@example.com', name: 'Alice' }), 2000)

    expect(again).toStrictEqual({
      ...created,
      email: 'alice@example.com',
      name: 'Alice',
      lastLoginAt: 2000,
    })
    expect(connection.db.select().from(users).all()).toHaveLength(2)
  })

  it('distingue deux providers qui émettent le même sub', () => {
    const local = recordLogin(connection.db, anIdentity('42'))
    const other = recordLogin(connection.db, anIdentity('42', { issuer: 'https://autre.example.com' }))

    expect(other.id).not.toBe(local.id)
    expect(other.role).toBe('user')
  })

  it('n\'utilise jamais l\'email comme identité', () => {
    const first = recordLogin(connection.db, anIdentity('alice', { email: 'partage@example.com' }))
    const second = recordLogin(connection.db, anIdentity('bob', { email: 'partage@example.com' }))

    expect(second.id).not.toBe(first.id)
  })
})

describe('recordDevBypassLogin', () => {
  let connection: DatabaseConnection

  beforeEach(() => {
    connection = createTestDatabase()
  })

  afterEach(() => {
    connection.sqlite.close()
  })

  it('ouvre un compte admin, même s\'il n\'est pas le premier', () => {
    recordLogin(connection.db, anIdentity('alice'))

    expect(recordDevBypassLogin(connection.db)).toMatchObject({
      issuer: DEV_BYPASS_IDENTITY.issuer,
      subject: 'dev',
      role: 'admin',
    })
  })

  it('remet le compte admin après une rétrogradation', () => {
    const user = recordDevBypassLogin(connection.db)

    connection.db.update(users).set({ role: 'user' }).where(eq(users.id, user.id)).run()

    expect(recordDevBypassLogin(connection.db)).toMatchObject({ id: user.id, role: 'admin' })
  })
})

describe('findUser', () => {
  it('relit le rôle en base : une rétrogradation se voit à la lecture suivante', () => {
    const connection = createTestDatabase()
    const admin = recordLogin(connection.db, anIdentity('alice'))

    connection.db.update(users).set({ role: 'user' }).where(eq(users.id, admin.id)).run()

    expect(findUser(connection.db, admin.id)?.role).toBe('user')
    expect(findUser(connection.db, crypto.randomUUID())).toBeUndefined()

    connection.sqlite.close()
  })
})
