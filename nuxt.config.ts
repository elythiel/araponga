import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { version } from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/test-utils/module'],

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
