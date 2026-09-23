import { H3Error } from 'h3'
import { API_ERROR_STATUS } from '#shared/api-errors'
import type { ApiErrorBody, ApiErrorCode } from '#shared/api-errors'
import type { ValidationIssue } from '#shared/schemas/validation'
import type { Locale } from './locale'

/** Le typage impose un message par code et par langue. */
const MESSAGES: Record<Locale, Record<ApiErrorCode, string>> = {
  fr: {
    bad_request: 'La requête est mal formée.',
    unauthenticated: 'Une connexion est nécessaire.',
    forbidden: 'Vos droits ne permettent pas cette action.',
    self_demotion: 'Vous ne pouvez pas retirer votre propre rôle d\'administrateur.',
    not_found: 'La ressource demandée n\'existe pas.',
    duplicate_sound: 'Ce fichier est déjà dans la board.',
    hotkey_taken: 'Ce raccourci est déjà assigné à un autre son.',
    tag_in_use: 'Ce tag est encore utilisé.',
    last_admin: 'L\'instance doit garder au moins un administrateur.',
    file_too_large: 'Le fichier dépasse 10 Mo.',
    unsupported_media_type: 'Ce fichier n\'est pas un format audio accepté.',
    validation_failed: 'Le formulaire contient des erreurs.',
    rate_limited: 'Trop de requêtes, réessayez dans quelques minutes.',
  },
  en: {
    bad_request: 'The request is malformed.',
    unauthenticated: 'You need to sign in.',
    forbidden: 'You are not allowed to do this.',
    self_demotion: 'You cannot remove your own administrator role.',
    not_found: 'The requested resource does not exist.',
    duplicate_sound: 'This file is already on the board.',
    hotkey_taken: 'This shortcut is already assigned to another sound.',
    tag_in_use: 'This tag is still in use.',
    last_admin: 'The instance must keep at least one administrator.',
    file_too_large: 'The file exceeds 10 MB.',
    unsupported_media_type: 'This file is not an accepted audio format.',
    validation_failed: 'The form contains errors.',
    rate_limited: 'Too many requests, try again in a few minutes.',
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
