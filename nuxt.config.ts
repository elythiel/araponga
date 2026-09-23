import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/test-utils/module'],

  // Tailwind n'est chargé que pour son reset (preflight) ; aucune
  // direction artistique n'est encore posée.
  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },
  compatibilityDate: '2025-07-15',

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
