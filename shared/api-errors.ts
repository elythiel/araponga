import type { ValidationIssue } from './schemas/validation'

/**
 * Codes d'erreur de l'API et leur statut HTTP, tels que les fixe
 * docs/03-api.md. Le code est le contrat : c'est sur lui que le client règle
 * son comportement, jamais sur le message. Chaque jalon y ajoute les siens.
 */
export const API_ERROR_STATUS = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  duplicate_sound: 409,
  hotkey_taken: 409,
  file_too_large: 413,
  unsupported_media_type: 415,
  validation_failed: 422,
  rate_limited: 429,
} as const

export type ApiErrorCode = keyof typeof API_ERROR_STATUS

/** Corps de toute réponse d'erreur de l'API. */
export interface ApiErrorBody {
  statusCode: number
  code: ApiErrorCode
  /** Déjà traduit selon `Accept-Language` : à afficher, jamais à interpréter. */
  message: string
  /** Une entrée par champ en faute, pour `validation_failed` uniquement. */
  issues?: ValidationIssue[]
  details?: Record<string, unknown>
}
