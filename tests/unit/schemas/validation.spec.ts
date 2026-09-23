// @vitest-environment node
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { validate } from '../../../shared/schemas/validation'
import { issuesOf } from './helpers'

describe('validate', () => {
  it('renvoie la sortie normalisée d\'une entrée valide', () => {
    const schema = v.object({ name: v.pipe(v.string(), v.trim()) })

    expect(validate(schema, { name: ' Tada ' })).toEqual({ success: true, output: { name: 'Tada' } })
  })

  describe('traduit chaque erreur Valibot en code stable', () => {
    const cases: [string, v.GenericSchema, unknown, object][] = [
      ['clé absente', v.object({ name: v.string() }), {}, { path: 'name', code: 'required' }],
      ['valeur nulle', v.object({ name: v.string() }), { name: null }, { path: 'name', code: 'required' }],
      ['chaîne vide', v.pipe(v.string(), v.nonEmpty()), '', { path: '', code: 'required' }],
      ['mauvais type', v.string(), 12, { path: '', code: 'invalid_type' }],
      ['hors liste', v.picklist(['a', 'b']), 'c', { path: '', code: 'invalid_value' }],
      ['texte trop court', v.pipe(v.string(), v.minLength(3)), 'ab', { path: '', code: 'too_short', min: 3 }],
      ['texte trop long', v.pipe(v.string(), v.maxLength(3)), 'abcd', { path: '', code: 'too_long', max: 3 }],
      ['liste trop courte', v.pipe(v.array(v.string()), v.minLength(2)), ['a'], { path: '', code: 'too_few', min: 2 }],
      ['liste trop longue', v.pipe(v.array(v.string()), v.maxLength(1)), ['a', 'b'], { path: '', code: 'too_many', max: 1 }],
      ['nombre trop petit', v.pipe(v.number(), v.minValue(0)), -1, { path: '', code: 'too_small', min: 0 }],
      ['nombre trop grand', v.pipe(v.number(), v.maxValue(10)), 11, { path: '', code: 'too_large', max: 10 }],
      ['nombre non entier', v.pipe(v.number(), v.integer()), 1.5, { path: '', code: 'not_integer' }],
      ['JSON illisible', v.pipe(v.string(), v.parseJson()), '{', { path: '', code: 'invalid_json' }],
      ['texte non numérique', v.pipe(v.string(), v.toNumber()), 'abc', { path: '', code: 'invalid_type' }],
      ['format', v.pipe(v.string(), v.regex(/^\d+$/)), 'abc', { path: '', code: 'invalid_format' }],
      ['UUID', v.pipe(v.string(), v.uuid()), 'abc', { path: '', code: 'invalid_format' }],
      ['contrôle maison', v.pipe(v.string(), v.check(() => false, 'duplicate')), 'a', { path: '', code: 'duplicate' }],
    ]

    it.each(cases)('%s', (_, schema, input, expected) => {
      expect(issuesOf(schema, input)).toEqual([expected])
    })

    it('replie sur `invalid` une erreur sans code dédié', () => {
      expect(issuesOf(v.pipe(v.string(), v.email()), 'abc')).toEqual([{ path: '', code: 'invalid' }])
      expect(issuesOf(v.pipe(v.string(), v.check(() => false, 'message libre')), 'a'))
        .toEqual([{ path: '', code: 'invalid' }])
    })
  })

  it('désigne le champ fautif en notation pointée', () => {
    const schema = v.object({ sound: v.object({ tags: v.array(v.string()) }) })

    expect(issuesOf(schema, { sound: { tags: ['a', 3] } }))
      .toEqual([{ path: 'sound.tags.1', code: 'invalid_type' }])
  })

  it('ne remonte que la première erreur d\'un champ', () => {
    const schema = v.pipe(v.string(), v.minLength(5), v.regex(/^\d+$/))

    expect(issuesOf(schema, 'ab')).toEqual([{ path: '', code: 'too_short', min: 5 }])
  })

  it('contrôle tous les champs, sans s\'arrêter au premier en faute', () => {
    const schema = v.object({ name: v.string(), role: v.picklist(['admin']) })

    expect(issuesOf(schema, { role: 'root' })).toEqual([
      { path: 'name', code: 'required' },
      { path: 'role', code: 'invalid_value' },
    ])
  })
})
