// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import type { CryptoKey, JWTPayload } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { createOidcClient } from '../../../server/services/oidc'
import type { OidcClientOptions, PendingLogin } from '../../../server/services/oidc'
import type { OidcConfig } from '../../../server/utils/auth-config'

const ISSUER = 'https://idp.example.com'
const CONFIG: OidcConfig = {
  issuer: ISSUER,
  clientId: 'araponga',
  clientSecret: 'secret',
  scopes: 'openid profile email',
  redirectUri: 'https://araponga.example.com/api/auth/callback',
}

interface ProviderBehaviour {
  /** Claims de l'`id_token`, fusionnés aux claims valides par défaut. */
  claims?: JWTPayload
  /** Clé de signature de l'`id_token` ; par défaut celle publiée dans le JWKS. */
  signingKey?: CryptoKey
  userinfo?: Record<string, unknown>
}

let publishedKey: { privateKey: CryptoKey, publicKey: CryptoKey }
let foreignKey: { privateKey: CryptoKey }

beforeAll(async () => {
  publishedKey = await generateKeyPair('RS256')
  foreignKey = await generateKeyPair('RS256')
})

/**
 * Provider OIDC minimal, joué en mémoire à la place du réseau. Il se comporte
 * comme un vrai sur ce qui compte : il vérifie le PKCE à l'échange du code et
 * signe l'`id_token` en RS256 avec une clé publiée dans son JWKS.
 */
function fakeProvider(behaviour: ProviderBehaviour = {}) {
  const codes = new Map<string, { challenge: string, nonce: string }>()
  const calls = { discovery: 0 }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const fetch: NonNullable<OidcClientOptions['fetch']> = async (url, options) => {
    const { pathname } = new URL(url)

    switch (pathname) {
      case '/.well-known/openid-configuration':
        calls.discovery++

        return json({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/authorize`,
          token_endpoint: `${ISSUER}/token`,
          userinfo_endpoint: `${ISSUER}/userinfo`,
          jwks_uri: `${ISSUER}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'],
        })
      case '/jwks':
        return json({ keys: [{ ...await exportJWK(publishedKey.publicKey), kid: 'cle', alg: 'RS256', use: 'sig' }] })
      case '/token': {
        const body = new URLSearchParams(options.body as string)
        const grant = codes.get(body.get('code') ?? '')
        const challenge = createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url')

        if (!grant || grant.challenge !== challenge) {
          return json({ error: 'invalid_grant' }, 400)
        }

        const now = Math.floor(Date.now() / 1000)
        // Tous les claims passent par l'objet : les `set…` de jose écraseraient
        // ceux qu'un test fausse exprès.
        const idToken = await new SignJWT({
          iss: ISSUER,
          aud: CONFIG.clientId,
          sub: 'alice',
          iat: now,
          exp: now + 300,
          nonce: grant.nonce,
          email: 'alice@example.com',
          ...behaviour.claims,
        })
          .setProtectedHeader({ alg: 'RS256', kid: 'cle' })
          .sign(behaviour.signingKey ?? publishedKey.privateKey)

        return json({ access_token: 'jeton', token_type: 'Bearer', expires_in: 300, id_token: idToken })
      }
      case '/userinfo':
        return json({ sub: 'alice', ...behaviour.userinfo })
      default:
        return json({ error: 'not_found' }, 404)
    }
  }

  /** Ce que fait le provider quand la personne s'authentifie : il émet un code. */
  function authorize(url: URL): string {
    const code = randomUUID()

    codes.set(code, {
      challenge: url.searchParams.get('code_challenge')!,
      nonce: url.searchParams.get('nonce')!,
    })

    return `?code=${code}&state=${url.searchParams.get('state')}`
  }

  return { fetch, authorize, calls }
}

async function login(provider: ReturnType<typeof fakeProvider>, tamper?: (pending: PendingLogin) => PendingLogin) {
  const client = createOidcClient(CONFIG, { fetch: provider.fetch })
  const { url, pending } = await client.startLogin('/admin')

  return client.finishLogin(provider.authorize(url), tamper ? tamper(pending) : pending)
}

describe('client OIDC', () => {
  it('envoie vers le provider avec PKCE S256, state, nonce et l\'URI déclarée', async () => {
    const provider = fakeProvider()
    const { url, pending } = await createOidcClient(CONFIG, { fetch: provider.fetch }).startLogin('/admin/tags')

    expect(url.origin + url.pathname).toBe(`${ISSUER}/authorize`)
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'araponga',
      redirect_uri: CONFIG.redirectUri,
      scope: 'openid profile email',
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(pending.codeVerifier).digest('base64url'),
      state: pending.state,
      nonce: pending.nonce,
    })
    expect(pending.redirect).toBe('/admin/tags')
  })

  it('établit l\'identité après un aller-retour complet', async () => {
    const identity = await login(fakeProvider({ claims: { name: 'Alice' } }))

    expect(identity).toStrictEqual({ issuer: ISSUER, subject: 'alice', email: 'alice@example.com', name: 'Alice' })
  })

  it('complète le profil par userinfo, preferred_username à défaut de name', async () => {
    const identity = await login(fakeProvider({ userinfo: { preferred_username: 'alice.l' } }))

    expect(identity.name).toBe('alice.l')
  })

  describe('refuse la connexion', () => {
    it('quand le state ne correspond pas', async () => {
      await expect(login(fakeProvider(), pending => ({ ...pending, state: 'autre' }))).rejects.toThrow()
    })

    it('quand le vérificateur PKCE ne correspond pas', async () => {
      await expect(login(fakeProvider(), pending => ({ ...pending, codeVerifier: 'x'.repeat(43) }))).rejects.toThrow()
    })

    it('quand le nonce de l\'id_token ne correspond pas', async () => {
      await expect(login(fakeProvider({ claims: { nonce: 'autre' } }))).rejects.toThrow()
    })

    it('quand l\'id_token est signé par une clé non publiée', async () => {
      await expect(login(fakeProvider({ signingKey: foreignKey.privateKey }))).rejects.toThrow()
    })

    it('quand l\'id_token est destiné à un autre client', async () => {
      await expect(login(fakeProvider({ claims: { aud: 'autre-client' } }))).rejects.toThrow()
    })

    it('quand l\'id_token vient d\'un autre émetteur', async () => {
      await expect(login(fakeProvider({ claims: { iss: 'https://evil.example.com' } }))).rejects.toThrow()
    })

    it('quand l\'id_token est expiré', async () => {
      const past = Math.floor(Date.now() / 1000) - 3600

      await expect(login(fakeProvider({ claims: { iat: past - 300, exp: past } }))).rejects.toThrow()
    })
  })

  describe('découverte', () => {
    it('n\'a lieu qu\'au premier besoin, puis est gardée une heure', async () => {
      const provider = fakeProvider()
      let now = 0
      const client = createOidcClient(CONFIG, { fetch: provider.fetch, now: () => now })

      expect(provider.calls.discovery).toBe(0)

      await client.startLogin('/admin')
      now += 59 * 60 * 1000
      await client.startLogin('/admin')

      expect(provider.calls.discovery).toBe(1)

      now += 2 * 60 * 1000
      await client.startLogin('/admin')

      expect(provider.calls.discovery).toBe(2)
    })

    it('ne garde pas un échec : la tentative suivante réessaie', async () => {
      const provider = fakeProvider()
      let reachable = false
      const client = createOidcClient(CONFIG, {
        fetch: (url, options) => (reachable ? provider.fetch(url, options) : Promise.reject(new Error('ECONNREFUSED'))),
      })

      await expect(client.startLogin('/admin')).rejects.toThrow()

      reachable = true

      await expect(client.startLogin('/admin')).resolves.toBeDefined()
    })
  })
})
