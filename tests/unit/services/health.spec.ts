// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { checkHealth } from '../../../server/services/health'
import { createTestDatabase } from '../database/helpers'

describe('checkHealth', () => {
  it('rapporte une base joignable', () => {
    const { db, sqlite } = createTestDatabase()

    expect(checkHealth(() => db, '1.2.3')).toStrictEqual({ status: 'ok', version: '1.2.3', database: 'ok' })

    sqlite.close()
  })

  it('rapporte une base fermée ou jamais ouverte, sans en révéler la cause', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db, sqlite } = createTestDatabase()

    sqlite.close()

    const expected = { status: 'error', version: '1.2.3', database: 'error' }

    expect(checkHealth(() => db, '1.2.3')).toStrictEqual(expected)
    expect(checkHealth(() => {
      throw new Error('La base de données n\'est pas ouverte.')
    }, '1.2.3')).toStrictEqual(expected)
    expect(logged).toHaveBeenCalledTimes(2)

    logged.mockRestore()
  })
})
