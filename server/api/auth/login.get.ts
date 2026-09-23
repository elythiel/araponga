import { getQuery, sendRedirect } from 'h3'
import { useDatabase } from '../../database/client'
import { useOidcClient } from '../../services/oidc'
import { recordDevBypassLogin } from '../../services/users'
import { useAuthConfig } from '../../utils/auth-config'
import { safeRedirect } from '../../utils/redirect'
import { openSession, savePendingLogin } from '../../utils/session-user'

export default defineEventHandler(async (event) => {
  const redirect = safeRedirect(getQuery(event).redirect)

  if (useAuthConfig().mode === 'bypass') {
    const user = recordDevBypassLogin(useDatabase())

    await openSession(event, user.id)

    return sendRedirect(event, redirect)
  }

  const { url, pending } = await useOidcClient().startLogin(redirect)

  await savePendingLogin(event, pending)

  return sendRedirect(event, url.href)
})
