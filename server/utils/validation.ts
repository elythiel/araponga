import { getQuery, readBody } from 'h3'
import type { H3Event } from 'h3'
import type { GenericSchema, InferOutput } from 'valibot'
import { validate } from '#shared/schemas/validation'
import { ApiError } from './errors'

/**
 * Valide une entrée contre un schéma partagé, ou lève une `422
 * validation_failed` dont chaque `issue` désigne un champ. Point de passage
 * commun des corps JSON, des query strings et, plus tard, des champs
 * multipart.
 */
export function parseInput<TSchema extends GenericSchema>(
  schema: TSchema,
  input: unknown,
): InferOutput<TSchema> {
  const result = validate(schema, input)

  if (!result.success) {
    throw new ApiError('validation_failed', { issues: result.issues })
  }

  return result.output
}

/**
 * À préférer à `readValidatedBody` de h3, qui convertit tout échec du
 * validateur en `400` : ici, un corps illisible reste une `400 bad_request`
 * et un corps invalide devient une `422`.
 */
export async function parseBody<TSchema extends GenericSchema>(
  event: H3Event,
  schema: TSchema,
): Promise<InferOutput<TSchema>> {
  let body: unknown

  try {
    body = await readBody(event, { strict: true })
  }
  catch (error) {
    throw new ApiError('bad_request', { cause: error })
  }

  return parseInput(schema, body)
}

export function parseQuery<TSchema extends GenericSchema>(
  event: H3Event,
  schema: TSchema,
): InferOutput<TSchema> {
  return parseInput(schema, getQuery(event))
}
