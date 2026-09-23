import { join } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { E2E_DATA_DIR } from '../../playwright.config'
import { wavFile } from './fixtures'

// Tags et comptes, par la session factice. Autonome : crée ses propres sons
// et les retire en partant, pour laisser la base vierge aux autres fichiers.
test.describe.configure({ mode: 'serial' })

test.use({ locale: 'fr-FR' })

let page: Page
const createdSoundIds: string[] = []

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/api/auth/login?redirect=/')

  // Deux sons portant le tag « Réplique culte ».
  for (const seed of [101, 102]) {
    const response = await page.request.post('/api/admin/sounds', {
      multipart: {
        name: `Réplique ${seed}`,
        tags: '["Réplique culte"]',
        file: { name: `replique-${seed}.wav`, mimeType: 'audio/wav', buffer: wavFile(seed) },
      },
    })

    expect(response.status()).toBe(201)
    createdSoundIds.push((await response.json()).id)
  }
})

test.afterAll(async () => {
  for (const id of createdSoundIds) {
    await page.request.delete(`/api/admin/sounds/${id}`)
  }

  for (const tag of await (await page.request.get('/api/admin/tags')).json()) {
    await page.request.delete(`/api/admin/tags/${tag.id}?force=true`)
  }

  await page.close()
})

async function visit(path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

const tagRow = (name: string) => page.locator('tbody tr', { has: page.getByRole('rowheader', { name, exact: true }) })

test.describe('tags', () => {
  test('crée un tag, puis retrouve l\'existant par son slug (200)', async () => {
    await visit('/admin/tags')

    const form = page.getByRole('group', { name: 'Créer un tag' })

    await form.getByLabel('Nom du tag').fill('Ambiances')
    await form.getByRole('button', { name: 'Créer' }).click()
    await expect(page.getByText('Le tag « Ambiances » a été créé.')).toBeVisible()
    await expect(tagRow('Ambiances')).toContainText('Orphelin')

    const again = page.waitForResponse(response => response.url().endsWith('/api/admin/tags') && response.request().method() === 'POST')

    await form.getByLabel('Nom du tag').fill('AMBIANCES')
    await form.getByRole('button', { name: 'Créer' }).click()

    expect((await again).status()).toBe(200)
    await expect(page.getByText('Le tag « Ambiances » existait déjà.')).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(2)
  })

  test('refuse un renommage vers le nom d\'un autre tag, sur le champ', async () => {
    await page.getByRole('button', { name: 'Renommer « Ambiances »' }).click()

    const dialog = page.getByRole('dialog', { name: 'Renommer « Ambiances »' })

    await dialog.getByLabel('Nom du tag').fill('replique culte')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.locator('#tag-rename-name-error')).toHaveText('Un autre tag porte déjà ce nom.')

    await dialog.getByLabel('Nom du tag').fill('Ambiances sonores')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog).toBeHidden()
    await expect(tagRow('Ambiances sonores')).toBeVisible()
  })

  test('supprimer un tag utilisé répond 409 ; confirmé, ?force=true le détache', async () => {
    const tagId = await tagRow('Réplique culte').getAttribute('data-tag-id')
    const refused = await page.request.delete(`/api/admin/tags/${tagId}`)

    expect(refused.status()).toBe(409)
    expect(await refused.json()).toMatchObject({ code: 'tag_in_use', details: { soundCount: 2 } })

    let question = ''

    page.once('dialog', (dialog) => {
      question = dialog.message()
      void dialog.accept()
    })

    await page.getByRole('button', { name: 'Supprimer « Réplique culte »' }).click()
    await expect(page.getByText('Le tag « Réplique culte » a été supprimé.')).toBeVisible()

    expect(question).toBe('Supprimer « Réplique culte » ? 2 sons perdront ce tag.')

    const { sounds } = await (await page.request.get('/api/sounds')).json()

    expect(sounds.filter((sound: { name: string }) => sound.name.startsWith('Réplique'))).toHaveLength(2)
    expect(sounds.every((sound: { tags: unknown[] }) => sound.tags.length === 0)).toBe(true)
  })
})

test.describe('comptes', () => {
  const OTHER_ID = '0192f3a1-0000-7000-8000-000000000042'

  test.beforeAll(() => {
    const sqlite = new BetterSqlite3(join(E2E_DATA_DIR, 'araponga.db'))

    sqlite.prepare('INSERT OR IGNORE INTO users (id, issuer, subject, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(OTHER_ID, 'https://idp.example.com', 'bob', 'Bob', 'user', Date.now())
    sqlite.close()
  })

  test('sa propre rétrogradation est désactivée, avec la raison affichée, et refusée en 403', async () => {
    await visit('/admin/users')

    const own = page.locator('tbody tr[data-current="true"]')

    await expect(own.getByRole('button', { name: /Rétrograder/ })).toBeDisabled()
    await expect(own.locator('[data-lock-reason]')).toContainText('votre propre rôle')

    const ownId = await own.getAttribute('data-user-id')
    const response = await page.request.patch(`/api/admin/users/${ownId}`, { data: { role: 'user' } })

    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'self_demotion' })
  })

  test('promeut puis rétrograde un autre compte', async () => {
    await page.getByRole('button', { name: 'Promouvoir « Bob » administrateur' }).click()
    await expect(page.getByText('« Bob » est maintenant Administrateur.')).toBeVisible()

    await page.getByRole('button', { name: 'Rétrograder « Bob » en utilisateur' }).click()
    await expect(page.getByText('« Bob » est maintenant Utilisateur.')).toBeVisible()
  })

  test('supprimer le dernier administrateur est impossible (409)', async () => {
    // Bob est redevenu user : le compte courant est le seul administrateur.
    // Sa rétrogradation bute d'abord sur `self_demotion` : le cas `last_admin`
    // d'une rétrogradation est couvert par les tests du service.
    const ownId = await page.locator('tbody tr[data-current="true"]').getAttribute('data-user-id')
    const deletion = await page.request.delete(`/api/admin/users/${ownId}`)

    expect(deletion.status()).toBe(409)
    expect(await deletion.json()).toMatchObject({ code: 'last_admin' })

    // Un compte qui n'est pas le dernier admin se supprime, lui.
    expect((await page.request.delete(`/api/admin/users/${OTHER_ID}`)).status()).toBe(204)
  })
})
