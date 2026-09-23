// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { UserRoleUpdateSchema } from '../../../shared/schemas/user'
import { issuesOf, outputOf } from './helpers'

describe('UserRoleUpdateSchema', () => {
  it.each(['admin', 'user'])('accepte le rôle « %s »', (role) => {
    expect(outputOf(UserRoleUpdateSchema, { role })).toEqual({ role })
  })

  it.each(['Admin', 'root', ''])('refuse le rôle « %s »', (role) => {
    expect(issuesOf(UserRoleUpdateSchema, { role })).toEqual([{ path: 'role', code: 'invalid_value' }])
  })

  it('exige le rôle', () => {
    expect(issuesOf(UserRoleUpdateSchema, {})).toEqual([{ path: 'role', code: 'required' }])
    expect(issuesOf(UserRoleUpdateSchema, { role: null })).toEqual([{ path: 'role', code: 'required' }])
  })
})
