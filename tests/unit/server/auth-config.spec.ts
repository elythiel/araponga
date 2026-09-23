// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseAuthConfig } from '../../../server/utils/auth-config'

const SESSION_PASSWORD = 'x'.repeat(32)

const COMPLETE = {
  APP_URL: 'https://araponga.example.com/',
  OIDC_ISSUER: 'https://auth.example.com',
  OIDC_CLIENT_ID: 'araponga',
  OIDC_CLIENT_SECRET: 'secret',
  SESSION_PASSWORD,
}

function errorsOf(env: Record<string, string | undefined>): string[] {
  const result = parseAuthConfig(env)

  if (result.success) {
    throw new Error('Configuration acceptée à tort.')
  }

  return result.errors
}

describe('parseAuthConfig', () => {
  it('accepte une configuration complète, avec les valeurs par défaut', () => {
    expect(parseAuthConfig(COMPLETE)).toStrictEqual({
      success: true,
      config: {
        mode: 'oidc',
        sessionPassword: SESSION_PASSWORD,
        oidc: {
          issuer: 'https://auth.example.com',
          clientId: 'araponga',
          clientSecret: 'secret',
          scopes: 'openid profile email',
          // Déduite de APP_URL, barre oblique finale comprise.
          redirectUri: 'https://araponga.example.com/api/auth/callback',
        },
      },
    })
  })

  it('préfère une URI de retour explicite à celle déduite de APP_URL', () => {
    const result = parseAuthConfig({ ...COMPLETE, APP_URL: undefined, OIDC_REDIRECT_URI: 'https://ailleurs.example.com/cb' })

    expect(result.success && result.config.mode === 'oidc' && result.config.oidc.redirectUri)
      .toBe('https://ailleurs.example.com/cb')
  })

  it.each([
    'OIDC_ISSUER',
    'OIDC_CLIENT_ID',
    'OIDC_CLIENT_SECRET',
    'SESSION_PASSWORD',
  ])('nomme %s quand elle manque', (name) => {
    expect(errorsOf({ ...COMPLETE, [name]: undefined })).toEqual([`${name} : required`])
  })

  it('traite une variable vide comme absente', () => {
    expect(errorsOf({ ...COMPLETE, OIDC_ISSUER: '', OIDC_CLIENT_SECRET: '   ' })).toEqual([
      'OIDC_ISSUER : required',
      'OIDC_CLIENT_SECRET : required',
    ])
  })

  it('exige APP_URL sans URI de retour explicite', () => {
    expect(errorsOf({ ...COMPLETE, APP_URL: undefined })).toEqual(['APP_URL : required'])
  })

  it('refuse un mot de passe de session trop court', () => {
    expect(errorsOf({ ...COMPLETE, SESSION_PASSWORD: 'court' })).toEqual(['SESSION_PASSWORD : too_short (32 minimum)'])
  })

  it('refuse un émetteur qui n\'est pas une URL et des portées sans openid', () => {
    expect(errorsOf({ ...COMPLETE, OIDC_ISSUER: 'auth.example.com', OIDC_SCOPES: 'profile email' })).toEqual([
      'OIDC_ISSUER : invalid_format',
      'OIDC_SCOPES : invalid_value',
    ])
  })

  describe('AUTH_DEV_BYPASS', () => {
    it('rend le provider facultatif', () => {
      expect(parseAuthConfig({ AUTH_DEV_BYPASS: '1', SESSION_PASSWORD })).toStrictEqual({
        success: true,
        config: { mode: 'bypass', sessionPassword: SESSION_PASSWORD },
      })
    })

    it('exige toujours SESSION_PASSWORD', () => {
      expect(errorsOf({ AUTH_DEV_BYPASS: '1' })).toEqual(['SESSION_PASSWORD : required'])
    })

    it('est refusé en production', () => {
      expect(errorsOf({ ...COMPLETE, AUTH_DEV_BYPASS: '1', NODE_ENV: 'production' })).toEqual([
        'AUTH_DEV_BYPASS : interdit quand NODE_ENV=production',
      ])
    })

    it.each(['', '0', 'false'])('reste inactif avec la valeur « %s »', (flag) => {
      expect(errorsOf({ AUTH_DEV_BYPASS: flag, SESSION_PASSWORD })).toContain('OIDC_ISSUER : required')
    })
  })
})
