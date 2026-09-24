import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { wavFile } from './fixtures'

// PWA et hors ligne, sur le build de production (le service worker n'existe
// qu'au build). Un seul contexte pour tout le fichier : les caches du service
// worker y persistent d'un test à l'autre, comme chez un vrai visiteur.
test.describe.configure({ mode: 'serial' })

test.use({ locale: 'fr-FR' })

let context: BrowserContext
let page: Page
const createdIds: string[] = []

const soundButton = (name: string) => page.getByRole('button', { name, exact: true })
const stopAll = () => page.locator('[data-action="stop-all"]')

/** Le service worker contrôle la page : ses règles de cache s'appliquent. */
async function waitForServiceWorker() {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
}

async function cachedPaths(): Promise<string[]> {
  return page.evaluate(async () => {
    const paths: string[] = []

    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        paths.push(`${name} ${new URL(request.url).pathname}`)
      }
    }

    return paths
  })
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ locale: 'fr-FR' })
  page = await context.newPage()
  await page.goto('/api/auth/login?redirect=/')

  for (const [name, seed] of [['Hors ligne A', 301], ['Hors ligne B', 302]] as const) {
    const response = await page.request.post('/api/admin/sounds', {
      multipart: { name, file: { name: `${seed}.wav`, mimeType: 'audio/wav', buffer: wavFile(seed, 4) } },
    })

    expect(response.status()).toBe(201)
    createdIds.push((await response.json()).id)
  }
})

test.afterAll(async () => {
  await context.setOffline(false)

  for (const id of createdIds) {
    await page.request.delete(`/api/admin/sounds/${id}`)
  }

  await context.close()
})

test('Chromium juge l\'application installable, et les balises iOS sont posées', async () => {
  await page.goto('/?q=hors')
  await waitForServiceWorker()

  const cdp = await context.newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')

  // Une session CDP laissée ouverte fait perdre l'émulation hors ligne à la
  // navigation suivante.
  await cdp.detach()

  expect(installabilityErrors).toEqual([])

  const manifest = await (await page.request.get('/manifest.webmanifest')).json()

  expect(manifest).toMatchObject({
    name: 'Araponga',
    short_name: 'Araponga',
    display: 'standalone',
    start_url: '/',
    orientation: 'any',
    categories: ['entertainment', 'utilities'],
  })
  expect(manifest.icons.map((icon: { sizes: string, purpose?: string }) => `${icon.sizes}${icon.purpose ? ` ${icon.purpose}` : ''}`))
    .toEqual(expect.arrayContaining(['192x192', '512x512', '512x512 maskable']))

  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
})

test('un son joué une fois se rejoue réseau coupé', async () => {
  await page.goto('/?q=hors')
  await waitForServiceWorker()

  await soundButton('Hors ligne A').click()
  await expect(stopAll()).toHaveText('Tout couper (1 en cours)')
  await stopAll().click()
  await expect.poll(cachedPaths).toContainEqual(expect.stringMatching(/^araponga-audio \/media\//))

  await context.setOffline(true)
  // Le rechargement vide la mémoire du lecteur : seul le cache du service
  // worker peut encore fournir le son.
  await page.reload()
  // Garde-fou du test : le réseau est vraiment coupé, sinon rien n'est prouvé.
  expect(await page.evaluate(() => fetch('/api/health').then(() => 'réseau', () => 'coupé'))).toBe('coupé')

  await expect(soundButton('Hors ligne A')).toBeVisible()
  await soundButton('Hors ligne A').click()
  await expect(stopAll()).toHaveText('Tout couper (1 en cours)')
  await stopAll().click()
})

test('un son jamais joué est dit indisponible hors ligne avant le clic, sans casser la board', async () => {
  // Toujours hors ligne, depuis le test précédent.
  await expect(soundButton('Hors ligne B')).toHaveAttribute('data-state', 'offline')
  await expect(soundButton('Hors ligne B')).toContainText('Indisponible hors ligne')
  await expect(soundButton('Hors ligne A')).not.toHaveAttribute('data-state', 'offline')

  await soundButton('Hors ligne B').click()
  await expect(soundButton('Hors ligne B')).toHaveAttribute('data-state', 'offline')
  await expect(stopAll()).toBeDisabled()

  await soundButton('Hors ligne A').click()
  await expect(stopAll()).toHaveText('Tout couper (1 en cours)')
  await stopAll().click()
})

test('l\'administration hors ligne affiche « connexion requise »', async () => {
  await page.goto('/admin')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connexion requise')
  await expect(page.getByRole('link', { name: 'Aller à la board' })).toHaveAttribute('href', '/')

  await context.setOffline(false)
})

test('ni l\'API d\'administration ou d\'authentification ni les pages d\'admin n\'entrent au cache', async () => {
  // Un parcours d'administration en ligne, sous le contrôle du service worker.
  await page.goto('/admin')
  await waitForServiceWorker()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Administration des sons')
  await page.goto('/admin/tags')
  await page.goto('/admin/users')
  await page.evaluate(() => Promise.all([
    fetch('/api/admin/sounds'),
    fetch('/api/auth/session'),
    fetch('/api/_auth/session'),
  ]))

  const paths = await cachedPaths()

  expect(paths.filter(path => /\s\/(api\/(admin|auth|_auth)|admin)(\/|$)/.test(path))).toEqual([])
  // Contrôle du test lui-même : la board, elle, est bien en cache.
  expect(paths).toContainEqual(expect.stringMatching(/^araponga-pages \/$/))
})

test('le cache audio porte un nom fixe, qui survit aux mises à jour', async () => {
  const sw = await (await page.request.get('/sw.js')).text()

  expect(sw).toContain('cacheName:"araponga-audio"')
  // Une mise à jour ne supprime que le precache périmé, jamais un cache nommé.
  expect(sw).toContain('cleanupOutdatedCaches()')
  expect(sw).not.toMatch(/caches\.delete/)
})
