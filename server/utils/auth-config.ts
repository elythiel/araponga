import * as v from 'valibot'
import { validate } from '#shared/schemas/validation'

export const SESSION_PASSWORD_MIN_LENGTH = 32

const DEFAULT_SCOPES = 'openid profile email'

const UrlSchema = v.pipe(v.string(), v.url())

const SessionSchema = v.object({
  SESSION_PASSWORD: v.pipe(v.string(), v.minLength(SESSION_PASSWORD_MIN_LENGTH)),
})

const OidcSchema = v.pipe(
  v.object({
    ...SessionSchema.entries,
    OIDC_ISSUER: UrlSchema,
    OIDC_CLIENT_ID: v.string(),
    OIDC_CLIENT_SECRET: v.string(),
    OIDC_SCOPES: v.optional(
      v.pipe(v.string(), v.check(scopes => scopes.split(/\s+/).includes('openid'), 'invalid_value')),
      DEFAULT_SCOPES,
    ),
    OIDC_REDIRECT_URI: v.optional(UrlSchema),
    APP_URL: v.optional(UrlSchema),
  }),
  // Sans URI explicite, elle se déduit de l'URL publique : l'une des deux
  // est indispensable, et c'est celle qu'on attend par défaut qui est nommée.
  v.forward(
    v.check(env => env.OIDC_REDIRECT_URI !== undefined || env.APP_URL !== undefined, 'required'),
    ['APP_URL'],
  ),
)

export interface OidcConfig {
  issuer: string
  clientId: string
  clientSecret: string
  scopes: string
  redirectUri: string
}

export type AuthConfig =
  | { mode: 'oidc', sessionPassword: string, oidc: OidcConfig }
  /** `AUTH_DEV_BYPASS` : session administrateur factice, aucun provider. */
  | { mode: 'bypass', sessionPassword: string }

export type AuthConfigResult =
  | { success: true, config: AuthConfig }
  | { success: false, errors: string[] }

function isEnabled(flag: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(flag?.trim().toLowerCase() ?? '')
}

/**
 * Valide la configuration d'authentification lue dans l'environnement.
 * Chaque erreur nomme sa variable : c'est tout ce qu'il faut pour corriger
 * un déploiement qui refuse de démarrer.
 */
export function parseAuthConfig(env: Record<string, string | undefined>): AuthConfigResult {
  const bypass = isEnabled(env.AUTH_DEV_BYPASS)

  if (bypass && env.NODE_ENV === 'production') {
    return { success: false, errors: ['AUTH_DEV_BYPASS : interdit quand NODE_ENV=production'] }
  }

  // Une variable vide dans `.env` (`OIDC_ISSUER=`) vaut une variable absente.
  const variables = Object.fromEntries(
    Object.entries(env).map(([name, value]) => [name, value?.trim() || undefined]),
  )

  const result = validate(bypass ? SessionSchema : OidcSchema, variables)

  if (!result.success) {
    return {
      success: false,
      errors: result.issues.map(issue =>
        `${issue.path} : ${issue.code}${issue.min === undefined ? '' : ` (${issue.min} minimum)`}`),
    }
  }

  const sessionPassword = result.output.SESSION_PASSWORD

  if (bypass) {
    return { success: true, config: { mode: 'bypass', sessionPassword } }
  }

  const output = result.output as v.InferOutput<typeof OidcSchema>

  return {
    success: true,
    config: {
      mode: 'oidc',
      sessionPassword,
      oidc: {
        issuer: output.OIDC_ISSUER,
        clientId: output.OIDC_CLIENT_ID,
        clientSecret: output.OIDC_CLIENT_SECRET,
        scopes: output.OIDC_SCOPES,
        redirectUri: output.OIDC_REDIRECT_URI ?? `${output.APP_URL!.replace(/\/+$/, '')}/api/auth/callback`,
      },
    },
  }
}

let current: AuthConfig | undefined

/** Posée une fois par `server/plugins/auth.ts`, avant la première requête. */
export function setAuthConfig(config: AuthConfig): void {
  current = config
}

export function useAuthConfig(): AuthConfig {
  if (!current) {
    throw new Error('La configuration d\'authentification n\'est pas chargée.')
  }

  return current
}
