import * as client from 'openid-client'
import { useAuthConfig } from '../utils/auth-config'
import type { OidcConfig } from '../utils/auth-config'
import type { OidcIdentity } from './users'

/** La découverte est refaite au plus une fois par heure. */
export const DISCOVERY_TTL_MS = 60 * 60 * 1000

/**
 * Ce que le navigateur doit rapporter du provider pour que la connexion soit
 * acceptée. Conservé entre les deux requêtes dans un cookie scellé.
 */
export interface PendingLogin {
  state: string
  nonce: string
  codeVerifier: string
  /** Destination interne après connexion, déjà vérifiée. */
  redirect: string
}

export interface OidcClient {
  /** URL du provider où envoyer le navigateur, et ce qu'il faut en retenir. */
  startLogin: (redirect: string) => Promise<{ url: URL, pending: PendingLogin }>
  /**
   * Échange le code et vérifie l'`id_token` : signature, `iss`, `aud`, `exp`,
   * `nonce`, ainsi que `state` et PKCE. Lève une erreur au moindre écart.
   */
  finishLogin: (callbackSearch: string, pending: PendingLogin) => Promise<OidcIdentity>
}

export interface OidcClientOptions {
  /** Remplace `fetch` vers le provider : les tests y branchent un faux provider. */
  fetch?: client.CustomFetch
  now?: () => number
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Client OIDC standard, sans rien qui soit propre à un provider : découverte,
 * Authorization Code + PKCE `S256`, claims `iss`, `sub`, `email`, `name` et
 * `preferred_username`.
 *
 * La découverte n'a lieu qu'au premier besoin : un provider injoignable rend
 * la connexion impossible, mais ne gêne ni le démarrage ni la board.
 */
export function createOidcClient(config: OidcConfig, options: OidcClientOptions = {}): OidcClient {
  const now = options.now ?? Date.now
  let cached: { configuration: Promise<client.Configuration>, expiresAt: number } | undefined

  function discover(): Promise<client.Configuration> {
    if (cached && cached.expiresAt > now()) {
      return cached.configuration
    }

    const issuer = new URL(config.issuer)
    const configuration = client.discovery(issuer, config.clientId, config.clientSecret, undefined, {
      // Un provider en HTTP n'a de sens qu'en local ; sans ce réglage,
      // openid-client refuse de lui parler.
      execute: [
        ...(issuer.protocol === 'http:' ? [client.allowInsecureRequests] : []),
        // L'`id_token` arrive directement du provider, mais sa signature est
        // tout de même vérifiée contre les clés publiées (`jwks_uri`).
        client.enableNonRepudiationChecks,
      ],
      ...(options.fetch && { [client.customFetch]: options.fetch }),
    })

    cached = { configuration, expiresAt: now() + DISCOVERY_TTL_MS }

    // Un échec n'est pas gardé en cache : la tentative suivante réessaie.
    configuration.catch(() => {
      if (cached?.configuration === configuration) {
        cached = undefined
      }
    })

    return configuration
  }

  async function startLogin(redirect: string) {
    const configuration = await discover()
    const codeVerifier = client.randomPKCECodeVerifier()
    const pending: PendingLogin = {
      state: client.randomState(),
      nonce: client.randomNonce(),
      codeVerifier,
      redirect,
    }

    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: config.redirectUri,
      scope: config.scopes,
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state: pending.state,
      nonce: pending.nonce,
    })

    return { url, pending }
  }

  async function finishLogin(callbackSearch: string, pending: PendingLogin): Promise<OidcIdentity> {
    const configuration = await discover()

    // L'URL de retour est reconstruite sur l'URI déclarée, pas sur la requête
    // reçue : derrière un proxy, l'hôte vu par Nitro n'est pas l'hôte public,
    // et le provider exige l'URI exacte.
    const callbackUrl = new URL(config.redirectUri)

    callbackUrl.search = callbackSearch

    const tokens = await client.authorizationCodeGrant(configuration, callbackUrl, {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    })

    const claims = tokens.claims()!
    let profile: Record<string, unknown> = claims

    // Beaucoup de providers ne mettent le profil que dans `userinfo`.
    if ((claims.email === undefined || claims.name === undefined) && configuration.serverMetadata().userinfo_endpoint) {
      profile = { ...await client.fetchUserInfo(configuration, tokens.access_token, claims.sub), ...claims }
    }

    return {
      issuer: claims.iss,
      subject: claims.sub,
      email: optionalString(profile.email),
      name: optionalString(profile.name) ?? optionalString(profile.preferred_username),
    }
  }

  return { startLogin, finishLogin }
}

let shared: OidcClient | undefined

/** Client du processus, construit au premier besoin sur la configuration validée. */
export function useOidcClient(): OidcClient {
  const config = useAuthConfig()

  if (config.mode !== 'oidc') {
    throw new Error('Aucun provider OIDC : AUTH_DEV_BYPASS est actif.')
  }

  shared ??= createOidcClient(config.oidc)

  return shared
}
