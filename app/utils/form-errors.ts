import type { ApiErrorBody } from '#shared/api-errors'
import type { ValidationIssue } from '#shared/schemas/validation'

/**
 * Une erreur à afficher, rattachée à un champ de formulaire (`path`), ou au
 * formulaire entier quand `path` est vide. Validation locale et réponses du
 * serveur aboutissent à la même forme : le formulaire n'a qu'un seul rendu.
 */
export interface FieldIssue {
  path: string
  code: string
  min?: number
  max?: number
  /** Son en cause, pour `duplicate_sound` et `hotkey_taken`. */
  soundId?: string
}

/**
 * Champ auquel se rapporte chaque erreur métier du serveur : les `409`,
 * `413` et `415` concernent un champ précis, pas le formulaire.
 */
const FIELD_OF_CODE: Record<string, string> = {
  duplicate_sound: 'file',
  file_too_large: 'file',
  unsupported_media_type: 'file',
  hotkey_taken: 'hotkey',
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'code' in value && 'statusCode' in value
}

export function issuesFromValidation(issues: ValidationIssue[]): FieldIssue[] {
  return issues.map(issue => ({ ...issue }))
}

/** Traduit une erreur de `$fetch` en erreurs par champ. */
export function issuesFromError(error: unknown): FieldIssue[] {
  const body = (error as { data?: unknown }).data

  if (!isApiErrorBody(body)) {
    return [{ path: '', code: 'unknown' }]
  }

  if (body.issues) {
    return issuesFromValidation(body.issues)
  }

  const soundId = typeof body.details?.soundId === 'string' ? body.details.soundId : undefined

  return [{ path: FIELD_OF_CODE[body.code] ?? '', code: body.code, ...(soundId && { soundId }) }]
}

/** Première erreur de chaque champ : c'est la seule qu'on affiche. */
export function issuesByPath(issues: FieldIssue[]): Record<string, FieldIssue> {
  const byPath: Record<string, FieldIssue> = {}

  for (const issue of issues) {
    // `tags.2` s'affiche sur le champ `tags`.
    const field = issue.path.split('.')[0] ?? ''

    byPath[field] ??= issue
  }

  return byPath
}
