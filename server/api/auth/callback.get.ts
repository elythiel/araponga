import { getRequestURL, sendRedirect } from 'h3'
import { useDatabase } from '../../database/client'
import { useOidcClient } from '../../services/oidc'
import { recordLogin } from '../../services/users'
import { ApiError } from '../../utils/errors'
import { openSession, takePendingLogin } from '../../utils/session-user'

export default defineEventHandler(async (event) => {
  // Absent : connexion expirée (10 min), jamais commencée ici, ou déjà utilisée.
  const pending = await takePendingLogin(event)

  if (!pending) {
    throw new ApiError('unauthenticated')
  }

  let identity

  try {
    identity = await useOidcClient().finishLogin(getRequestURL(event).search, pending)
  }
  catch (error) {
    // Le détail (state, signature, refus du provider…) ne sert qu'aux logs.
    console.warn('[auth] connexion refusée', error)
    throw new ApiError('unauthenticated', { cause: error })
  }

  const user = recordLogin(useDatabase(), identity)

  await openSession(event, user.id)

  return sendRedirect(event, pending.redirect)
})
