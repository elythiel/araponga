import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Port dédié aux tests : un serveur de développement déjà ouvert sur 3000,
// fût-il celui d'un autre projet, ne doit jamais être testé à sa place.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100)
// `localhost` et pas `127.0.0.1` : le serveur de développement de Nuxt
// n'écoute que sur la boucle locale IPv6.
const baseURL = `http://localhost:${PORT}`

/**
 * Volume du serveur de test, vidé à chaque lancement : la base part vierge.
 * Chemin fixe et non tiré au hasard, parce que ce fichier est relu par chaque
 * worker, et que les tests ouvrent la même base que le serveur.
 */
export const E2E_DATA_DIR = join(tmpdir(), `araponga-e2e-${PORT}`)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Un seul worker : tous les tests partagent la base du serveur et le compte
  // factice, qu'un test rétrograde pendant qu'un autre administre.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `rm -rf "${E2E_DATA_DIR}" && yarn dev --port ${PORT}`,
    // Les e2e passent par la session factice : aucun provider OIDC requis.
    env: {
      DATA_DIR: E2E_DATA_DIR,
      AUTH_DEV_BYPASS: '1',
      SESSION_PASSWORD: 'e2e-uniquement-jamais-en-production',
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
