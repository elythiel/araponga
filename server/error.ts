import { getRequestHeader, send, setResponseHeader, setResponseStatus } from 'h3'
import type { NitroErrorHandler } from 'nitropack/types'
import { ApiError, toApiErrorBody } from './utils/errors'
import { negotiateLocale } from './utils/locale'

/**
 * Rend les `ApiError` au format normalisé de docs/03-api.md. Toute autre
 * erreur passe aux gestionnaires suivants — celui de Nuxt (pages d'erreur),
 * puis celui de Nitro. Enregistré devant eux par `nuxt.config.ts`.
 */
const apiErrorHandler: NitroErrorHandler = (error, event) => {
  if (event.handled || !(error instanceof ApiError)) {
    return
  }

  const body = toApiErrorBody(error, negotiateLocale(getRequestHeader(event, 'accept-language')))

  setResponseStatus(event, body.statusCode)
  setResponseHeader(event, 'content-type', 'application/json')
  setResponseHeader(event, 'cache-control', 'no-store')

  return send(event, JSON.stringify(body))
}

export default apiErrorHandler
