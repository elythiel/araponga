import { parseAuthConfig, setAuthConfig } from '../utils/auth-config'

export default defineNitroPlugin(() => {
  const result = parseAuthConfig(process.env)

  if (!result.success) {
    // Mieux vaut ne pas démarrer que servir une connexion cassée, découverte
    // le jour où l'on en a besoin.
    console.error(
      `[auth] configuration incomplète, arrêt du serveur :\n${result.errors.map(error => `  - ${error}`).join('\n')}`,
    )
    process.exit(1)
  }

  setAuthConfig(result.config)

  // nuxt-auth-utils lit son mot de passe sous ce nom, au premier usage d'une
  // session : c'est la valeur validée de `SESSION_PASSWORD` qu'il y trouve.
  process.env.NUXT_SESSION_PASSWORD = result.config.sessionPassword

  if (result.config.mode === 'bypass') {
    console.warn(
      '[auth] AUTH_DEV_BYPASS actif : /api/auth/login ouvre une session administrateur '
      + 'sans provider OIDC. À ne jamais laisser en place hors développement.',
    )
  }
})
