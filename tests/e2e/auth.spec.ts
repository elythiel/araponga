import { join } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { E2E_DATA_DIR } from '../../playwright.config'

// Parcours d'authentification complet, par la session factice d'AUTH_DEV_BYPASS
// que le serveur de test active. Les tests partagent un même compte : ils
// s'enchaînent au lieu de tourner en parallèle.
test.describe.configure({ mode: 'serial' })

/** Route d'administration en lecture : la garde répond avant elle. */
const ADMIN_ROUTE = '/api/admin/sounds'

/** Change un rôle directement en base, comme le fera l'écran des utilisateurs. */
function setDevRole(role: 'admin' | 'user') {
  const sqlite = new BetterSqlite3(join(E2E_DATA_DIR, 'araponga.db'))

  try {
    sqlite.prepare('UPDATE users SET role = ? WHERE issuer = ?').run(role, 'urn:araponga:dev-bypass')
  }
  finally {
    sqlite.close()
  }
}

async function sessionUser(request: APIRequestContext) {
  return (await (await request.get('/api/auth/session')).json()).user
}

test('sans session, l\'administration répond 401', async ({ request }) => {
  const response = await request.get(ADMIN_ROUTE)

  expect(response.status()).toBe(401)
  expect(await response.json()).toMatchObject({ code: 'unauthenticated' })
  expect(await sessionUser(request)).toBeNull()
})

test('connexion, rétrogradation sans reconnexion, puis déconnexion', async ({ page }) => {
  const { request } = page.context()

  await page.goto('/api/auth/login?redirect=/')

  await expect(page).toHaveURL('/')
  expect(await sessionUser(request)).toMatchObject({ name: 'Développement', role: 'admin' })

  // Admin : la garde laisse passer.
  expect((await request.get(ADMIN_ROUTE)).status()).toBe(200)

  setDevRole('user')

  const demoted = await request.get(ADMIN_ROUTE)

  expect(demoted.status()).toBe(403)
  expect(await demoted.json()).toMatchObject({ code: 'forbidden' })
  expect(await sessionUser(request)).toMatchObject({ role: 'user' })

  setDevRole('admin')

  expect((await request.get(ADMIN_ROUTE)).status()).toBe(200)

  const logout = await request.post('/api/auth/logout', { maxRedirects: 0 })

  expect(logout.status()).toBe(303)
  expect(logout.headers().location).toBe('/')
  expect((await request.get(ADMIN_ROUTE)).status()).toBe(401)
  expect(await sessionUser(request)).toBeNull()
})

test('une destination externe est remplacée par /admin', async ({ request }) => {
  const response = await request.get('/api/auth/login?redirect=//evil.example.com', { maxRedirects: 0 })

  expect(response.status()).toBe(302)
  expect(response.headers().location).toBe('/admin')
})
