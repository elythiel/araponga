import { defineConfig, devices } from '@playwright/test'

// Port dédié aux tests : un serveur de développement déjà ouvert sur 3000,
// fût-il celui d'un autre projet, ne doit jamais être testé à sa place.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100)
// `localhost` et pas `127.0.0.1` : le serveur de développement de Nuxt
// n'écoute que sur la boucle locale IPv6.
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `yarn dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
