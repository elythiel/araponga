// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SoundCreateSchema,
  SoundQuerySchema,
  SoundReorderSchema,
  SoundUpdateSchema,
} from '../../../shared/schemas/sound'
import { issuesOf, outputOf } from './helpers'

const ID_A = '0192f3a1-7c4e-7b2a-9f10-3c5d6e7f8a9b'
const ID_B = '0192f3a1-7c4e-7b2a-9f10-3c5d6e7f8a9c'

const elevenTags = JSON.stringify(Array.from({ length: 11 }, (_, index) => `Tag ${index}`))

describe('SoundCreateSchema', () => {
  it('n\'exige que le nom', () => {
    expect(outputOf(SoundCreateSchema, { name: 'Tada' })).toEqual({
      name: 'Tada',
      description: null,
      tags: [],
      hotkey: null,
      durationMs: null,
    })
  })

  it('lit les champs texte du multipart', () => {
    expect(outputOf(SoundCreateSchema, {
      name: ' Tada ',
      description: ' Un classique ',
      tags: '["Classiques", "jeux-video"]',
      hotkey: 'T',
      durationMs: '1420',
    })).toEqual({
      name: 'Tada',
      description: 'Un classique',
      tags: ['Classiques', 'jeux-video'],
      hotkey: 't',
      durationMs: 1420,
    })
  })

  it('traite un champ laissé vide comme absent', () => {
    expect(outputOf(SoundCreateSchema, { name: 'Tada', description: '  ', hotkey: '', durationMs: '' }))
      .toMatchObject({ description: null, hotkey: null, durationMs: null })
  })

  it('fusionne les tags de même slug avant de les compter', () => {
    const tags = JSON.stringify([
      ...Array.from({ length: 10 }, (_, index) => `Tag ${index}`),
      'tag-0',
      'TAG 1',
    ])

    expect(outputOf(SoundCreateSchema, { name: 'Tada', tags }).tags).toHaveLength(10)
  })

  it('accepte les longueurs maximales', () => {
    expect(outputOf(SoundCreateSchema, { name: 'a'.repeat(80), description: 'b'.repeat(280) }))
      .toMatchObject({ name: 'a'.repeat(80), description: 'b'.repeat(280) })
  })

  it('écarte les champs que le client n\'a pas à fixer', () => {
    expect(outputOf(SoundCreateSchema, { name: 'Tada', checksum: 'f'.repeat(64), position: 3 }))
      .not.toHaveProperty('checksum')
  })

  it('exige le nom', () => {
    expect(issuesOf(SoundCreateSchema, {})).toEqual([{ path: 'name', code: 'required' }])
  })

  it.each([
    ['un nom blanc', { name: '  ' }, { path: 'name', code: 'required' }],
    ['un nom trop long', { name: 'a'.repeat(81) }, { path: 'name', code: 'too_long', max: 80 }],
    ['une description trop longue', { description: 'b'.repeat(281) }, { path: 'description', code: 'too_long', max: 280 }],
    ['des tags hors JSON', { tags: 'Blagues' }, { path: 'tags', code: 'invalid_json' }],
    ['des tags hors tableau', { tags: '{"name":"Blagues"}' }, { path: 'tags', code: 'invalid_type' }],
    ['un tag sans slug', { tags: '["Blagues", "!!!"]' }, { path: 'tags.1', code: 'no_slug' }],
    ['plus de dix tags', { tags: elevenTags }, { path: 'tags', code: 'too_many', max: 10 }],
    ['un raccourci inconnu', { hotkey: 'F13' }, { path: 'hotkey', code: 'invalid_value' }],
    ['une durée non numérique', { durationMs: 'abc' }, { path: 'durationMs', code: 'invalid_type' }],
    ['une durée négative', { durationMs: '-1' }, { path: 'durationMs', code: 'too_small', min: 0 }],
    ['une durée fractionnaire', { durationMs: '1.5' }, { path: 'durationMs', code: 'not_integer' }],
  ])('refuse %s', (_, fields, expected) => {
    expect(issuesOf(SoundCreateSchema, { name: 'Tada', ...fields })).toEqual([expected])
  })

  it('signale tous les champs en faute d\'un coup', () => {
    expect(issuesOf(SoundCreateSchema, { name: '', hotkey: 'F13' })).toEqual([
      { path: 'name', code: 'required' },
      { path: 'hotkey', code: 'invalid_value' },
    ])
  })
})

describe('SoundUpdateSchema', () => {
  it('conserve tout champ absent', () => {
    expect(outputOf(SoundUpdateSchema, {})).toStrictEqual({})
    expect(outputOf(SoundUpdateSchema, { name: ' Nouveau ' })).toStrictEqual({ name: 'Nouveau' })
  })

  it('efface la description et le raccourci par `null` ou une chaîne vide', () => {
    expect(outputOf(SoundUpdateSchema, { description: null, hotkey: null }))
      .toStrictEqual({ description: null, hotkey: null })
    expect(outputOf(SoundUpdateSchema, { description: '', hotkey: ' ' }))
      .toStrictEqual({ description: null, hotkey: null })
  })

  it('normalise raccourci et tags', () => {
    expect(outputOf(SoundUpdateSchema, { hotkey: 'B', tags: ['Blagues', 'blagues'] }))
      .toStrictEqual({ hotkey: 'b', tags: ['Blagues'] })
  })

  it('accepte de retirer tous les tags', () => {
    expect(outputOf(SoundUpdateSchema, { tags: [] })).toStrictEqual({ tags: [] })
  })

  it.each([
    ['un nom nul', { name: null }, { path: 'name', code: 'required' }],
    ['un nom vide', { name: '' }, { path: 'name', code: 'required' }],
    ['des tags en texte : le corps est du JSON', { tags: '["Blagues"]' }, { path: 'tags', code: 'invalid_type' }],
    ['plus de dix tags', { tags: JSON.parse(elevenTags) }, { path: 'tags', code: 'too_many', max: 10 }],
    ['un raccourci combiné', { hotkey: 'ctrl+a' }, { path: 'hotkey', code: 'invalid_value' }],
    ['une description trop longue', { description: 'b'.repeat(281) }, { path: 'description', code: 'too_long', max: 280 }],
  ])('refuse %s', (_, body, expected) => {
    expect(issuesOf(SoundUpdateSchema, body)).toEqual([expected])
  })
})

describe('SoundReorderSchema', () => {
  it('accepte une liste d\'identifiants', () => {
    expect(outputOf(SoundReorderSchema, { ids: [ID_B, ID_A] })).toEqual({ ids: [ID_B, ID_A] })
  })

  it('accepte une liste vide : le catalogue peut l\'être', () => {
    expect(outputOf(SoundReorderSchema, { ids: [] })).toEqual({ ids: [] })
  })

  it('ramène les identifiants en minuscules', () => {
    expect(outputOf(SoundReorderSchema, { ids: [ID_A.toUpperCase()] })).toEqual({ ids: [ID_A] })
  })

  it.each([
    ['une liste absente', {}, { path: 'ids', code: 'required' }],
    ['autre chose qu\'une liste', { ids: ID_A }, { path: 'ids', code: 'invalid_type' }],
    ['un identifiant mal formé', { ids: [ID_A, 'nope'] }, { path: 'ids.1', code: 'invalid_format' }],
    ['un doublon', { ids: [ID_A, ID_B, ID_A] }, { path: 'ids', code: 'duplicate' }],
    ['un doublon à la casse près', { ids: [ID_A, ID_A.toUpperCase()] }, { path: 'ids', code: 'duplicate' }],
  ])('refuse %s', (_, body, expected) => {
    expect(issuesOf(SoundReorderSchema, body)).toEqual([expected])
  })
})

describe('SoundQuerySchema', () => {
  it('n\'exige aucun paramètre', () => {
    expect(outputOf(SoundQuerySchema, {})).toEqual({ tags: [] })
  })

  it('nettoie la recherche et ignore une recherche vide', () => {
    expect(outputOf(SoundQuerySchema, { q: ' tada ' })).toEqual({ q: 'tada', tags: [] })
    expect(outputOf(SoundQuerySchema, { q: '   ' })).toEqual({ tags: [] })
  })

  it('accepte un tag seul ou une clé répétée', () => {
    expect(outputOf(SoundQuerySchema, { tags: 'blagues' })).toEqual({ tags: ['blagues'] })
    expect(outputOf(SoundQuerySchema, { tags: ['blagues', 'jeux-video'] }))
      .toEqual({ tags: ['blagues', 'jeux-video'] })
  })

  it('ignore les valeurs de tag vides', () => {
    expect(outputOf(SoundQuerySchema, { tags: '' })).toEqual({ tags: [] })
    expect(outputOf(SoundQuerySchema, { tags: ['', 'blagues'] })).toEqual({ tags: ['blagues'] })
  })

  it.each([
    ['une recherche trop longue', { q: 'a'.repeat(81) }, { path: 'q', code: 'too_long', max: 80 }],
    ['une recherche répétée', { q: ['a', 'b'] }, { path: 'q', code: 'invalid_type' }],
    ['un nom de tag au lieu d\'un slug', { tags: 'Blagues' }, { path: 'tags.0', code: 'invalid_format' }],
    ['un slug mal formé', { tags: ['blagues', 'jeux video'] }, { path: 'tags.1', code: 'invalid_format' }],
  ])('refuse %s', (_, query, expected) => {
    expect(issuesOf(SoundQuerySchema, query)).toEqual([expected])
  })
})
