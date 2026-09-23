import * as v from 'valibot'

/**
 * Codes des erreurs de validation. Ils forment un contrat : le client en tire
 * ses messages traduits, champ par champ, qu'ils viennent de sa propre
 * validation ou d'une `422` du serveur. En renommer un casse l'API.
 */
export const VALIDATION_ISSUE_CODES = [
  'required',
  'invalid_type',
  'invalid_json',
  'invalid_format',
  'invalid_value',
  'too_short',
  'too_long',
  'too_few',
  'too_many',
  'too_small',
  'too_large',
  'not_integer',
  'duplicate',
  'no_slug',
  'invalid',
] as const

export type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODES)[number]

/**
 * Une erreur rattachée à un champ de formulaire. `path` suit la notation
 * pointée (`name`, `tags.2`) et vaut `''` pour l'entrée entière.
 */
export interface ValidationIssue {
  path: string
  code: ValidationIssueCode
  min?: number
  max?: number
}

export type ValidationResult<TOutput> =
  | { success: true, output: TOutput }
  | { success: false, issues: ValidationIssue[] }

/**
 * Même réglage des deux côtés : chaque champ ne remonte que sa première
 * erreur, les autres champs sont tous contrôlés.
 */
const CONFIG = { abortPipeEarly: true } as const

type Issue = v.BaseIssue<unknown>

function isIssueCode(value: string): value is ValidationIssueCode {
  return (VALIDATION_ISSUE_CODES as readonly string[]).includes(value)
}

function codeOf(issue: Issue): ValidationIssueCode {
  // Un contrôle maison (`v.check`) porte son code en guise de message.
  if (isIssueCode(issue.message)) {
    return issue.message
  }

  if (issue.kind === 'schema') {
    // Clé absente ou `null` : pour un formulaire, c'est un champ non rempli.
    if (issue.input === undefined || issue.input === null) {
      return 'required'
    }

    return issue.type === 'picklist' ? 'invalid_value' : 'invalid_type'
  }

  const isList = Array.isArray(issue.input)

  switch (issue.type) {
    case 'non_empty':
      return 'required'
    case 'min_length':
      return isList ? 'too_few' : 'too_short'
    case 'max_length':
      return isList ? 'too_many' : 'too_long'
    case 'min_value':
      return 'too_small'
    case 'max_value':
      return 'too_large'
    case 'integer':
    case 'safe_integer':
      return 'not_integer'
    case 'parse_json':
      return 'invalid_json'
    case 'to_number':
      return 'invalid_type'
    case 'regex':
    case 'uuid':
      return 'invalid_format'
    default:
      return 'invalid'
  }
}

function boundsOf(issue: Issue): Pick<ValidationIssue, 'min' | 'max'> {
  if (typeof issue.requirement !== 'number') {
    return {}
  }

  switch (issue.type) {
    case 'min_length':
    case 'min_value':
      return { min: issue.requirement }
    case 'max_length':
    case 'max_value':
      return { max: issue.requirement }
    default:
      return {}
  }
}

/**
 * Valide une entrée et traduit les erreurs Valibot en erreurs par champ, avec
 * un code stable. C'est la seule façon de valider, côté client comme côté
 * serveur : les deux produisent ainsi exactement les mêmes erreurs.
 */
export function validate<TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown,
): ValidationResult<v.InferOutput<TSchema>> {
  const result = v.safeParse(schema, input, CONFIG)

  if (result.success) {
    return { success: true, output: result.output }
  }

  return {
    success: false,
    issues: result.issues.map(issue => ({
      path: v.getDotPath(issue) ?? '',
      code: codeOf(issue),
      ...boundsOf(issue),
    })),
  }
}
