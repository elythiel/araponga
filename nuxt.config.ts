import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { version } from './package.json'
import { AUDIO_CACHE, CATALOG_CACHE, OFFLINE_PAGE, PAGES_CACHE } from './shared/pwa'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/test-utils/module', 'nuxt-auth-utils', '@nuxtjs/i18n', '@vite-pwa/nuxt'],

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

  // Voir docs/06-pwa-offline.md. Le service worker n'existe qu'au build : en
  // développement, un SW qui met le HMR en cache rend le débogage infernal.
  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Araponga',
      short_name: 'Araponga',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      orientation: 'any',
      categories: ['entertainment', 'utilities'],
      lang: 'fr',
      // Valeurs neutres de passe 1, posées à l'habillage (J11).
      theme_color: '#ffffff',
      background_color: '#ffffff',
    },
    pwaAssets: { config: true },
    workbox: {
      // Rendu serveur : aucun HTML dans le precache, seulement les assets du
      // build et la page hors ligne prérendue.
      // Les messages i18n sont chargés à part : sans eux, la board hors ligne
      // perdrait ses libellés. Pas de `webmanifest` : le module l'ajoute
      // déjà, et un doublon fait échouer tout le service worker.
      globPatterns: ['**/*.{js,css,svg,png,ico}', '_i18n/**/*.json', 'offline/index.html'],
      // Le module servirait sinon `/` à toute navigation, même en ligne.
      navigateFallback: null,
      cleanupOutdatedCaches: true,
      // Premier service worker : il prend la main tout de suite, pour que les
      // sons de la première visite entrent au cache. Une mise à jour, elle,
      // attend « Recharger » (pas de skipWaiting).
      clientsClaim: true,
      skipWaiting: false,
      // Les motifs sont sérialisés dans le service worker : ils ne peuvent
      // rien capturer de ce fichier. L'ordre compte, la première règle gagne.
      runtimeCaching: [
        {
          urlPattern: ({ url }) => /^\/api\/(admin|auth|_auth)(\/|$)/.test(url.pathname),
          handler: 'NetworkOnly',
        },
        {
          urlPattern: ({ url }) => url.pathname === '/api/sounds',
          handler: 'NetworkFirst',
          options: {
            cacheName: CATALOG_CACHE,
            networkTimeoutSeconds: 3,
            cacheableResponse: { statuses: [200] },
          },
        },
        {
          // Immuable par construction : l'URL est le checksum du fichier.
          urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
          handler: 'CacheFirst',
          options: {
            cacheName: AUDIO_CACHE,
            expiration: { maxEntries: 200, maxAgeSeconds: 90 * 24 * 60 * 60 },
            // Jamais une 206 ni une réponse opaque ; une requête Range est
            // servie à partir de la réponse complète en cache.
            cacheableResponse: { statuses: [200] },
            rangeRequests: true,
          },
        },
        {
          urlPattern: ({ request, url }) => request.mode === 'navigate' && /^\/admin(\/|$)/.test(url.pathname),
          handler: 'NetworkOnly',
          options: {
            plugins: [{
              // Hors ligne : la page « connexion requise », jamais le HTML
              // d'une page d'administration.
              // Chemin en dur : la fonction est sérialisée, sans OFFLINE_PAGE.
              // Le module range la page prérendue sous `offline`, suivi de
              // la révision en query string.
              handlerDidError: () => caches.match('/offline', { ignoreSearch: true }),
            }],
          },
        },
        {
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: {
            cacheName: PAGES_CACHE,
            networkTimeoutSeconds: 3,
            cacheableResponse: { statuses: [200] },
          },
        },
      ],
    },
    client: {
      // Vérifie une nouvelle version toutes les heures, sans jamais recharger.
      periodicSyncForUpdates: 3600,
    },
    devOptions: { enabled: false },
  },

  nitro: {
    // Seule page statique : sa version prérendue est précachée par le SW.
    prerender: { routes: [OFFLINE_PAGE] },
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
