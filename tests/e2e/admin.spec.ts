import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { E2E_DATA_DIR } from '../../playwright.config'
import { ZIP_FILE, wavFile } from './fixtures'

// Parcours d'administration des sons, sur une base vierge : les tests
// s'appuient sur ce que les précédents ont ajouté.
test.describe.configure({ mode: 'serial' })

test.use({ locale: 'fr-FR' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})

test.afterAll(async () => {
  await page.close()
})

async function upload(name: string, file: { name: string, buffer: Buffer }, fields: { hotkey?: string, tags?: string } = {}) {
  const form = page.getByRole('group', { name: 'Ajouter un son' })

  await form.getByLabel('Fichier audio').setInputFiles({ ...file, mimeType: 'audio/wav' })
  await form.getByLabel('Nom').fill(name)
  await form.getByLabel('Raccourci').fill(fields.hotkey ?? '')
  await form.getByLabel('Tags').fill(fields.tags ?? '')
  await form.getByRole('button', { name: 'Ajouter' }).click()
}

const rowNames = () => page.locator('tbody th').allTextContents()

/**
 * La page est rendue côté serveur : un champ rempli avant l'hydratation
 * serait remis à zéro par Vue. On attend que le JavaScript soit chargé.
 */
async function visit(path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

test('sans session, /admin passe par la connexion et y revient', async () => {
  await visit('/admin')

  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Administration des sons')
  await expect(page.getByText('Aucun son pour l\'instant')).toBeVisible()
})

test('ajoute un son, qui est servi par /media', async () => {
  await upload('Tada', { name: 'tada.wav', buffer: wavFile(1) }, { hotkey: 't', tags: 'Blagues, Cinéma' })

  await expect(page.getByRole('status').filter({ hasText: '« Tada » a été ajouté.' })).toBeVisible()
  expect(await rowNames()).toEqual(['Tada'])

  const { sounds } = await (await page.request.get('/api/sounds')).json()

  expect(sounds[0]).toMatchObject({ name: 'Tada', hotkey: 't', mimeType: 'audio/wav' })
  expect((await page.request.get(sounds[0].url)).status()).toBe(200)
})

test('un .mp3 qui est un ZIP est refusé sur le champ fichier (415)', async () => {
  const response = page.waitForResponse('/api/admin/sounds')

  await upload('Faux', { name: 'faux.mp3', buffer: ZIP_FILE })

  expect((await response).status()).toBe(415)
  await expect(page.locator('#upload-file-error')).toHaveText('Ce fichier n\'est pas un format audio accepté.')
})

test('un raccourci déjà pris est signalé sur le champ raccourci (409)', async () => {
  const response = page.waitForResponse('/api/admin/sounds')

  await upload('Autre', { name: 'autre.wav', buffer: wavFile(2) }, { hotkey: 'T' })

  expect((await response).status()).toBe(409)
  await expect(page.locator('#upload-hotkey-error')).toHaveText('Ce raccourci est déjà assigné à « Tada ».')
  await expect(page.locator('#upload-hotkey')).toBeFocused()
})

test('un doublon renvoie 409 et un lien vers le son existant', async () => {
  const response = page.waitForResponse('/api/admin/sounds')

  await upload('Copie', { name: 'copie.wav', buffer: wavFile(1) })

  expect((await response).status()).toBe(409)

  const link = page.locator('#upload-file-error').getByRole('link', { name: 'Voir « Tada »' })

  await link.click()
  await expect(page).toHaveURL(/#sound-/)
  expect(await rowNames()).toEqual(['Tada'])
})

test('un fichier de plus de 10 Mo est refusé (413) sans rien laisser', async () => {
  const response = await page.request.post('/api/admin/sounds', {
    multipart: {
      name: 'Énorme',
      file: { name: 'enorme.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(11 * 1024 * 1024) },
    },
  })

  expect(response.status()).toBe(413)
  expect(await response.json()).toMatchObject({ code: 'file_too_large' })
  expect(await readdir(join(E2E_DATA_DIR, 'media', '.tmp')).catch(() => [])).toEqual([])
  expect((await (await page.request.get('/api/sounds')).json()).sounds).toHaveLength(1)
})

test('le réordonnancement se fait entièrement au clavier', async () => {
  await upload('Bravo', { name: 'bravo.wav', buffer: wavFile(3) })
  await expect(page.getByText('« Bravo » a été ajouté.')).toBeVisible()
  await upload('Charlie', { name: 'charlie.wav', buffer: wavFile(4) })
  await expect(page.getByText('« Charlie » a été ajouté.')).toBeVisible()

  expect(await rowNames()).toEqual(['Tada', 'Bravo', 'Charlie'])

  // Depuis la recherche, la tabulation seule mène au bouton.
  await page.getByLabel('Rechercher un son').focus()

  for (let presses = 0; presses < 30; presses++) {
    await page.keyboard.press('Tab')

    if (await page.getByRole('button', { name: 'Descendre « Tada »' }).evaluate(button => button === document.activeElement)) {
      break
    }
  }

  await expect(page.getByRole('button', { name: 'Descendre « Tada »' })).toBeFocused()

  await page.keyboard.press('Enter')
  await expect.poll(rowNames).toEqual(['Bravo', 'Tada', 'Charlie'])
  await expect(page.getByRole('button', { name: 'Descendre « Tada »' })).toBeFocused()

  await page.keyboard.press('Space')
  await expect.poll(rowNames).toEqual(['Bravo', 'Charlie', 'Tada'])
  // En bas de liste, le focus passe sur « Monter ».
  await expect(page.getByRole('button', { name: 'Monter « Tada »' })).toBeFocused()
  await expect(page.getByText('« Tada » est maintenant en position 3 sur 3.')).toBeAttached()

  await page.reload()
  await page.waitForLoadState('networkidle')

  expect(await rowNames()).toEqual(['Bravo', 'Charlie', 'Tada'])
})

test('le réordonnancement se fait aussi par glisser-déposer', async () => {
  const handle = (name: string) => page.locator('tbody tr', { hasText: name }).locator('[data-drag-handle]')

  await handle('Tada').dragTo(handle('Bravo'))

  await expect.poll(rowNames).toEqual(['Tada', 'Bravo', 'Charlie'])

  await page.reload()
  await page.waitForLoadState('networkidle')

  expect(await rowNames()).toEqual(['Tada', 'Bravo', 'Charlie'])
})

test('modifie un son dans la boîte de dialogue', async () => {
  await page.getByRole('button', { name: 'Modifier « Charlie »' }).click()

  const dialog = page.getByRole('dialog', { name: 'Modifier « Charlie »' })

  await dialog.getByLabel('Raccourci').fill('t')
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(dialog.locator('#edit-hotkey-error')).toHaveText('Ce raccourci est déjà assigné à « Tada ».')

  await dialog.getByLabel('Raccourci').fill('c')
  await dialog.getByLabel('Nom').fill('Charlie bis')
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(dialog).toBeHidden()
  expect(await rowNames()).toEqual(['Tada', 'Bravo', 'Charlie bis'])
})

test('supprime un son après confirmation', async () => {
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Supprimer « Bravo »' }).click()

  await expect(page.getByText('« Bravo » a été supprimé.')).toBeVisible()
  expect(await rowNames()).toEqual(['Tada', 'Charlie bis'])
})
