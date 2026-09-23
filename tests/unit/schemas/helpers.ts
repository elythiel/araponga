import type { GenericSchema, InferOutput } from 'valibot'
import { validate } from '../../../shared/schemas/validation'
import type { ValidationIssue } from '../../../shared/schemas/validation'

/**
 * Les tests passent par `validate`, comme le client et le serveur : ce sont
 * donc les erreurs réellement renvoyées, codes compris, qui sont vérifiées.
 */
export function outputOf<TSchema extends GenericSchema>(
  schema: TSchema,
  input: unknown,
): InferOutput<TSchema> {
  const result = validate(schema, input)

  if (!result.success) {
    throw new Error(`Entrée refusée à tort : ${JSON.stringify(result.issues)}`)
  }

  return result.output
}

export function issuesOf(schema: GenericSchema, input: unknown): ValidationIssue[] {
  const result = validate(schema, input)

  if (result.success) {
    throw new Error(`Entrée acceptée à tort : ${JSON.stringify(result.output)}`)
  }

  return result.issues
}
