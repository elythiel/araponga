import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    // Les tests e2e sont pilotés par Playwright, pas par Vitest.
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
      },
    },
  },
})
