import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { version } from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/test-utils/module', 'nuxt-auth-utils', '@nuxtjs/i18n'],

  // Aucune page n'a encore besoin de la session : la charger à chaque rendu
  // coûterait une requête interne par visite de la board publique.
  auth: {
    loadStrategy: 'none',
  },

  // La langue est une préférence, pas une route : pas de préfixe d'URL.
  // Les fichiers vivent dans `i18n/locales/`.
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'araponga-locale',
      redirectOn: 'root',
    },
  },

  // Tailwind n'est chargé que pour son reset (preflight) ; aucune
  // direction artistique n'est encore posée.
  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },
  compatibilityDate: '2025-07-15',

  runtimeConfig: {
    // Volume unique : la base SQLite et les médias vivent sous ce répertoire.
    dataDir: process.env.DATA_DIR ?? './data',
    // Figée au build : c'est la version de l'image, exposée par /api/health.
    appVersion: version,
    // Le mot de passe n'est jamais lu ici, au build : il finirait dans le
    // bundle. `server/plugins/auth.ts` le valide et le transmet au démarrage.
    session: {
      name: 'araponga-session',
      password: '',
      // 30 jours, prolongés à l'usage (voir `server/utils/session-user.ts`).
      maxAge: 60 * 60 * 24 * 30,
      cookie: { sameSite: 'lax', secure: true, httpOnly: true },
    },
  },

  // Sans valeur en développement, nuxt-auth-utils écrirait son propre mot de
  // passe dans `.env`, sous un autre nom que `SESSION_PASSWORD`.
  $development: {
    runtimeConfig: {
      session: { password: 'remplacé au démarrage par server/plugins/auth.ts' },
    },
  },

  nitro: {
    // Les migrations sont embarquées dans le bundle serveur, faute de quoi
    // elles seraient introuvables au démarrage d'une image de production.
    serverAssets: [
      {
        baseName: 'migrations',
        dir: fileURLToPath(new URL('server/database/migrations', import.meta.url)),
      },
    ],
  },

  hooks: {
    // Nuxt ne déclare son gestionnaire d'erreurs que si aucun autre ne l'est :
    // celui de l'API se place donc devant le sien, sans le remplacer.
    'nitro:config'(nitroConfig) {
      nitroConfig.errorHandler = [
        fileURLToPath(new URL('server/error.ts', import.meta.url)),
        ...[nitroConfig.errorHandler ?? []].flat(),
      ]
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  typescript: {
    strict: true,
    typeCheck: false,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
      },
    },
  },
})
