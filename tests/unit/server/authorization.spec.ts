// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assertAdmin, isAdminPath } from '../../../server/utils/authorization'
import { aUser } from '../database/helpers'

describe('isAdminPath', () => {
  it.each([
    '/api/admin',
    '/api/admin/',
    '/api/admin/sounds',
    '/api/admin/sounds?force=true',
    '/api/admin?x=1',
    // Formes qu'un routeur plus tolérant pourrait servir : gardées aussi.
    '/api/ADMIN/sounds',
    '//api//admin/sounds',
    '/api/%61dmin/sounds',
    '/api\\admin/sounds',
  ])('garde %s', (path) => {
    expect(isAdminPath(path)).toBe(true)
  })

  it.each([
    '/',
    '/admin',
    '/api/sounds',
    '/api/auth/login',
    '/api/administration',
    '/api/adminsounds',
  ])('laisse passer %s', (path) => {
    expect(isAdminPath(path)).toBe(false)
  })

  it('ne lève pas sur un encodage invalide', () => {
    expect(isAdminPath('/api/admin/%E0%A4%A')).toBe(true)
  })
})

describe('assertAdmin', () => {
  it('refuse l\'absence de session en 401', () => {
    expect(() => assertAdmin(null)).toThrow(expect.objectContaining({ statusCode: 401, code: 'unauthenticated' }))
  })

  it('refuse le rôle user en 403', () => {
    expect(() => assertAdmin(aUser({ role: 'user' }) as never))
      .toThrow(expect.objectContaining({ statusCode: 403, code: 'forbidden' }))
  })

  it('laisse passer un admin', () => {
    const admin = aUser({ role: 'admin' }) as never

    expect(assertAdmin(admin)).toBe(admin)
  })
})
