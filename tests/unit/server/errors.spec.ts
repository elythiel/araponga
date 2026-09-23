// @vitest-environment node
import { isError } from 'h3'
import { describe, expect, it } from 'vitest'
import { ApiError, toApiErrorBody } from '../../../server/utils/errors'

describe('ApiError', () => {
  it('tire son statut HTTP de son code', () => {
    expect(new ApiError('validation_failed').statusCode).toBe(422)
    expect(new ApiError('bad_request').statusCode).toBe(400)
  })

  it('est une erreur h3 : Nitro la transmet intacte au gestionnaire d\'erreurs', () => {
    expect(isError(new ApiError('bad_request'))).toBe(true)
  })
})

describe('toApiErrorBody', () => {
  const issues = [{ path: 'name', code: 'too_long' as const, max: 80 }]

  it('produit le corps normalisé, message traduit', () => {
    const error = new ApiError('validation_failed', { issues })

    expect(toApiErrorBody(error, 'fr')).toStrictEqual({
      statusCode: 422,
      code: 'validation_failed',
      message: 'Le formulaire contient des erreurs.',
      issues,
    })
    expect(toApiErrorBody(error, 'en').message).toBe('The form contains errors.')
  })

  it('n\'ajoute `issues` et `details` que s\'ils existent', () => {
    expect(toApiErrorBody(new ApiError('bad_request'), 'fr')).toStrictEqual({
      statusCode: 400,
      code: 'bad_request',
      message: 'La requête est mal formée.',
    })
    expect(toApiErrorBody(new ApiError('bad_request', { details: { field: 'file' } }), 'fr'))
      .toMatchObject({ details: { field: 'file' } })
  })
})
