import { assertAdmin, isAdminPath } from '../utils/authorization'
import { resolveSessionUser } from '../utils/session-user'

/**
 * Garde unique de `/api/admin/**` : aucun handler ne refait ce contrôle.
 * `401` sans session, `403` sans le rôle `admin`, relu en base à chaque
 * requête.
 */
export default defineEventHandler(async (event) => {
  if (!isAdminPath(event.path)) {
    return
  }

  event.context.user = assertAdmin(await resolveSessionUser(event))
})
