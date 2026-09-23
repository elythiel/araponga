// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../../../server/utils/rate-limit'

describe('createRateLimiter', () => {
  it('permet `limit` tentatives par fenêtre, puis donne le délai d\'attente', () => {
    let now = 0
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => now })

    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')]).toEqual([null, null, null])

    now = 400

    expect(limiter.hit('a')).toBe(600)
  })

  it('fait glisser la fenêtre : la plus ancienne tentative expire en premier', () => {
    let now = 0
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now })

    limiter.hit('a')
    now = 500
    limiter.hit('a')
    now = 1001

    expect(limiter.hit('a')).toBeNull()
    expect(limiter.hit('a')).toBe(499)
  })

  it('compte chaque clé à part', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 })

    expect(limiter.hit('a')).toBeNull()
    expect(limiter.hit('b')).toBeNull()
    expect(limiter.hit('a')).not.toBeNull()
  })
})
