// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  TagCreateSchema,
  TagNameSchema,
  TagSlugSchema,
  TagUpdateSchema,
  slugify,
} from '../../../shared/schemas/tag'
import { issuesOf, outputOf } from './helpers'

describe('slugify', () => {
  const cases = [
    ['Blagues', 'blagues'],
    ['Jeux vidéo', 'jeux-video'],
    ['JEUX-VIDÉO', 'jeux-video'],
    ['  Ça   marche !! ', 'ca-marche'],
    ['Cœur & âme', 'coeur-ame'],
    ['Ex æquo', 'ex-aequo'],
    ['Straße', 'strasse'],
    ['ﬁlm noir', 'film-noir'],
    ['Été 2024', 'ete-2024'],
    ['--a--b--', 'a-b'],
    ['🎉', ''],
  ]

  it.each(cases)('« %s » donne « %s »', (name, slug) => {
    expect(slugify(name)).toBe(slug)
  })

  it.each(cases)('est idempotent sur « %s »', (name) => {
    expect(slugify(slugify(name))).toBe(slugify(name))
  })

  it('fait de « Blagues » et « blagues » un seul tag', () => {
    expect(slugify('Blagues')).toBe(slugify('blagues'))
  })
})

describe('TagNameSchema', () => {
  it('garde le nom tel quel, sans les blancs qui l\'entourent', () => {
    expect(outputOf(TagNameSchema, ' Jeux vidéo ')).toBe('Jeux vidéo')
  })

  it('accepte 32 caractères', () => {
    expect(outputOf(TagNameSchema, 'a'.repeat(32))).toBe('a'.repeat(32))
  })

  it.each([
    ['vide', '', { code: 'required' }],
    ['blanc', '   ', { code: 'required' }],
    ['trop long', 'a'.repeat(33), { code: 'too_long', max: 32 }],
    ['sans lettre ni chiffre', '!!!', { code: 'no_slug' }],
    ['en émojis seuls', '🎉', { code: 'no_slug' }],
    ['d\'un autre type', 12, { code: 'invalid_type' }],
  ])('refuse un nom %s', (_, input, expected) => {
    expect(issuesOf(TagNameSchema, input)).toEqual([{ path: '', ...expected }])
  })
})

describe('TagSlugSchema', () => {
  it.each(['blagues', 'jeux-video', '2024'])('accepte « %s »', (slug) => {
    expect(outputOf(TagSlugSchema, slug)).toBe(slug)
  })

  it.each(['', 'Blagues', 'jeux video', 'jeux--video', '-blagues', 'blagues-', 'vidéo'])(
    'refuse « %s »',
    (slug) => {
      expect(issuesOf(TagSlugSchema, slug)).toEqual([{ path: '', code: 'invalid_format' }])
    },
  )
})

describe.each([
  ['TagCreateSchema', TagCreateSchema],
  ['TagUpdateSchema', TagUpdateSchema],
])('%s', (_, schema) => {
  it('accepte un nom', () => {
    expect(outputOf(schema, { name: ' Blagues ' })).toEqual({ name: 'Blagues' })
  })

  it('ignore un slug fourni : il se déduit toujours du nom', () => {
    expect(outputOf(schema, { name: 'Blagues', slug: 'autre' })).toEqual({ name: 'Blagues' })
  })

  it('exige le nom', () => {
    expect(issuesOf(schema, {})).toEqual([{ path: 'name', code: 'required' }])
  })

  it('refuse un nom sans slug', () => {
    expect(issuesOf(schema, { name: '???' })).toEqual([{ path: 'name', code: 'no_slug' }])
  })

  it('refuse autre chose qu\'un objet', () => {
    expect(issuesOf(schema, 'Blagues')).toEqual([{ path: '', code: 'invalid_type' }])
  })
})
