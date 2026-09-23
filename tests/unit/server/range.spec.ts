// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseRange } from '../../../server/utils/range'

const SIZE = 1000

describe('parseRange', () => {
  it.each([
    ['bytes=0-99', { start: 0, end: 99 }],
    ['bytes=500-', { start: 500, end: 999 }],
    ['bytes=-100', { start: 900, end: 999 }],
    ['bytes=990-5000', { start: 990, end: 999 }],
    ['bytes=-5000', { start: 0, end: 999 }],
    ['bytes=0-0', { start: 0, end: 0 }],
  ])('%s donne un fragment borné à la ressource', (header, range) => {
    expect(parseRange(header, SIZE)).toStrictEqual(range)
  })

  it.each([
    ['bytes=1000-'],
    ['bytes=1000-1100'],
    ['bytes=-0'],
  ])('%s est insatisfiable', (header) => {
    expect(parseRange(header, SIZE)).toBe('unsatisfiable')
  })

  it('tout fragment est insatisfiable sur une ressource vide', () => {
    expect(parseRange('bytes=0-', 0)).toBe('unsatisfiable')
    expect(parseRange('bytes=-10', 0)).toBe('unsatisfiable')
  })

  it.each([
    ['absent', undefined],
    ['d\'une autre unité', 'items=0-10'],
    ['sans bornes', 'bytes=-'],
    ['à l\'envers', 'bytes=100-50'],
    ['à plusieurs fragments', 'bytes=0-10,20-30'],
    ['illisible', 'bytes=abc'],
  ])('un en-tête %s est ignoré : la ressource est servie entière', (_, header) => {
    expect(parseRange(header, SIZE)).toBeNull()
  })
})
