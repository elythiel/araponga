import { useSession } from 'h3'
import type { H3Event } from 'h3'
import { useDatabase } from '../database/client'
import type { User } from '../database/schema'
import type { PendingLogin } from '../services/oidc'
import { findUser } from '../services/users'
import { useAuthConfig } from './auth-config'

declare module 'h3' {
  interface H3EventContext {
    /** Administrateur authentifié, posé par la garde de `/api/admin`. */
    user?: User
  }
}

/**
 * Le cookie est réémis au plus une fois par jour : la session expire après
 * 30 jours d'inactivité, pas 30 jours après la connexion.
 */
const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000

/** Durée laissée pour revenir du provider, en secondes. */
const LOGIN_MAX_AGE = 10 * 60

export async function openSession(event: H3Event, userId: string): Promise<void> {
  await replaceUserSession(event, { user: { id: userId }, refreshedAt: Date.now() })
}

/**
 * Utilisateur de la session, relu en base. Un compte supprimé entre-temps
 * ferme la session.
 */
export async function resolveSessionUser(event: H3Event): Promise<User | null> {
  const session = await getUserSession(event)
  const userId = session.user?.id

  if (!userId) {
    return null
  }

  const user = findUser(useDatabase(), userId)

  if (!user) {
    await clearUserSession(event)

    return null
  }

  if (Date.now() - (session.refreshedAt ?? 0) > SESSION_REFRESH_MS) {
    await openSession(event, user.id)
  }

  return user
}

/**
 * Cookie de connexion en cours, scellé comme la session et limité aux routes
 * d'authentification : `state`, `nonce`, vérificateur PKCE et destination.
 */
function useLoginSession(event: H3Event) {
  return useSession<Partial<PendingLogin>>(event, {
    name: 'araponga-login',
    password: useAuthConfig().sessionPassword,
    maxAge: LOGIN_MAX_AGE,
    sessionHeader: false,
    cookie: { path: '/api/auth', sameSite: 'lax', secure: true, httpOnly: true },
  })
}

export async function savePendingLogin(event: H3Event, pending: PendingLogin): Promise<void> {
  const session = await useLoginSession(event)

  await session.update(pending)
}

/** Lit la connexion en cours et l'efface : un retour du provider ne sert qu'une fois. */
export async function takePendingLogin(event: H3Event): Promise<PendingLogin | null> {
  const session = await useLoginSession(event)
  const { state, nonce, codeVerifier, redirect } = session.data

  await session.clear()

  return state && nonce && codeVerifier && redirect ? { state, nonce, codeVerifier, redirect } : null
}
