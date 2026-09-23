import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

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
