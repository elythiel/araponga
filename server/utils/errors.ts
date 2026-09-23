import { H3Error } from 'h3'
import { API_ERROR_STATUS } from '#shared/api-errors'
import type { ApiErrorBody, ApiErrorCode } from '#shared/api-errors'
import type { ValidationIssue } from '#shared/schemas/validation'
import type { Locale } from './locale'

/** Le typage impose un message par code et par langue. */
const MESSAGES: Record<Locale, Record<ApiErrorCode, string>> = {
  fr: {
    bad_request: 'La requête est mal formée.',
    validation_failed: 'Le formulaire contient des erreurs.',
  },
  en: {
    bad_request: 'The request is malformed.',
    validation_failed: 'The form contains errors.',
  },
}

export interface ApiErrorOptions {
  issues?: ValidationIssue[]
  details?: Record<string, unknown>
  cause?: unknown
}

/**
 * Erreur rendue au format normalisé de l'API par `server/error.ts`. Elle ne
 * porte qu'un code : le message est traduit au moment de répondre, seul
 * instant où la langue du client est connue.
 */
export class ApiError extends H3Error {
  readonly code: ApiErrorCode
  readonly issues?: ValidationIssue[]
  readonly details?: Record<string, unknown>

  constructor(code: ApiErrorCode, options: ApiErrorOptions = {}) {
    super(code, { cause: options.cause })
    this.code = code
    this.statusCode = API_ERROR_STATUS[code]
    this.issues = options.issues
    this.details = options.details
  }
}

export function toApiErrorBody(error: ApiError, locale: Locale): ApiErrorBody {
  return {
    statusCode: error.statusCode,
    code: error.code,
    message: MESSAGES[locale][error.code],
    ...(error.issues && { issues: error.issues }),
    ...(error.details && { details: error.details }),
  }
}
