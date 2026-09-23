// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { IdSchema } from '../../../shared/schemas/id'
import { issuesOf, outputOf } from './helpers'

const ID = '0192f3a1-7c4e-7b2a-9f10-3c5d6e7f8a9b'

describe('IdSchema', () => {
  it('accepte un UUID', () => {
    expect(outputOf(IdSchema, ID)).toBe(ID)
  })

  it('le ramène en minuscules, comme en base', () => {
    expect(outputOf(IdSchema, ID.toUpperCase())).toBe(ID)
  })

  it.each(['', 'nope', ID.replaceAll('-', ''), `${ID}0`])('refuse « %s »', (input) => {
    expect(issuesOf(IdSchema, input)).toEqual([{ path: '', code: 'invalid_format' }])
  })

  it('refuse autre chose qu\'une chaîne', () => {
    expect(issuesOf(IdSchema, 42)).toEqual([{ path: '', code: 'invalid_type' }])
  })
})
