import { join } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { E2E_DATA_DIR } from '../../playwright.config'
import { wavFile } from './fixtures'

// La board, contre une base remise à zéro au début du fichier : quatre vrais
// sons de 4 s (pour qu'ils se superposent) et 50 lignes de remplissage, sans
// fichier, pour dépasser une page de 48.
test.describe.configure({ mode: 'serial' })

test.use({ locale: 'fr-FR' })

let page: Page

const FILLERS = 50

const SOUNDS = [
  { name: 'Alpha', hotkey: 'a', tags: ['Blagues'], seed: 201 },
  { name: 'Bravo', hotkey: 'b', tags: ['Blagues', 'Cinéma'], seed: 202 },
  { name: 'Charlie', hotkey: '', tags: ['Cinéma'], seed: 203 },
  { name: 'Verre brisé', hotkey: '', tags: [], seed: 204 },
]

async function visit(path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

const stopAll = () => page.locator('[data-action="stop-all"]')
const gridNames = () => page.locator('[data-sound-grid] [id$="-name"]').allTextContents()
const soundButton = (name: string) => page.getByRole('button', { name, exact: true })

/** Tabulation seule jusqu'à `target` : le test ne clique jamais. */
async function tabTo(target: Locator, { backwards = false, max = 80 } = {}) {
  for (let presses = 0; presses < max; presses++) {
    if (await target.evaluate(element => element === document.activeElement)) {
      return
    }

    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab')
  }

  throw new Error('Élément jamais atteint à la tabulation.')
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/api/auth/login?redirect=/')

  const { sounds } = await (await page.request.get('/api/admin/sounds')).json()

  for (const sound of sounds) {
    await page.request.delete(`/api/admin/sounds/${sound.id}`)
  }

  for (const tag of await (await page.request.get('/api/admin/tags')).json()) {
    await page.request.delete(`/api/admin/tags/${tag.id}?force=true`)
  }
})

test.afterAll(async () => {
  const sqlite = new BetterSqlite3(join(E2E_DATA_DIR, 'araponga.db'))

  sqlite.prepare('DELETE FROM sounds WHERE name LIKE ?').run('Remplissage %')
  sqlite.close()

  const { sounds } = await (await page.request.get('/api/admin/sounds')).json()

  for (const sound of sounds) {
    await page.request.delete(`/api/admin/sounds/${sound.id}`)
  }

  await page.close()
})

test('une board vide le dit, avec un lien vers l\'administration pour un admin', async () => {
  await visit('/')

  await expect(page.locator('[data-state="empty"]')).toContainText('Aucun son dans la board')
  await expect(page.getByRole('link', { name: 'Ajouter des sons' })).toHaveAttribute('href', '/admin')
  await expect(stopAll()).toBeDisabled()
})

test('mise en place du catalogue', async () => {
  for (const sound of SOUNDS) {
    const response = await page.request.post('/api/admin/sounds', {
      multipart: {
        name: sound.name,
        hotkey: sound.hotkey,
        tags: JSON.stringify(sound.tags),
        file: { name: `${sound.seed}.wav`, mimeType: 'audio/wav', buffer: wavFile(sound.seed, 4) },
      },
    })

    expect(response.status()).toBe(201)
  }

  const sqlite = new BetterSqlite3(join(E2E_DATA_DIR, 'araponga.db'))
  const insert = sqlite.prepare(`INSERT INTO sounds
    (id, name, checksum, extension, mime_type, size_bytes, original_filename, position, created_at, updated_at)
    VALUES (?, ?, ?, 'wav', 'audio/wav', 100, 'remplissage.wav', ?, 0, 0)`)

  for (let index = 0; index < FILLERS; index++) {
    const suffix = String(index).padStart(12, '0')

    insert.run(`0192f3a1-0000-7000-8000-${suffix}`, `Remplissage ${String(index).padStart(2, '0')}`, `f${suffix}`.padEnd(64, 'e'), 100_000 + index)
  }

  sqlite.close()
})

test('deux sons, et deux instances d\'un même son, se superposent ; « Tout couper » les arrête', async () => {
  await visit('/')

  await soundButton('Alpha').click()
  await soundButton('Bravo').click()
  await soundButton('Alpha').click()

  await expect(stopAll()).toHaveText('Tout couper (3 en cours)')
  await expect(soundButton('Alpha')).toHaveAttribute('data-playing', 'true')
  await expect(soundButton('Bravo')).toHaveAttribute('data-playing', 'true')
  await expect(page.locator('[data-playback-status]')).toHaveText('Lecture en cours.')

  await stopAll().click()

  await expect(stopAll()).toHaveText('Tout couper')
  await expect(stopAll()).toBeDisabled()
  await expect(page.locator('[data-playing]')).toHaveCount(0)
  await expect(page.locator('[data-playback-status]')).toHaveText('Plus aucun son ne joue.')
})

test('les raccourcis jouent, Échap coupe ; rien dans un champ ni avec un modificateur', async () => {
  await page.locator('h1').click()

  await page.keyboard.press('a')
  await page.keyboard.press('b')
  await expect(stopAll()).toHaveText('Tout couper (2 en cours)')

  await page.keyboard.press('Escape')
  await expect(stopAll()).toBeDisabled()

  await page.getByLabel('Rechercher un son').focus()
  await page.keyboard.type('ab')
  await page.keyboard.press('Escape')
  await page.locator('h1').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Alt+b')

  await expect(stopAll()).toBeDisabled()
})

test('les raccourcis ne se déclenchent pas en administration', async () => {
  await visit('/')
  await page.getByRole('link', { name: 'Administration' }).click()
  await expect(page).toHaveURL('/admin')

  await page.locator('h1').click()
  await page.keyboard.press('a')
  await page.keyboard.press('b')

  await page.getByRole('link', { name: 'Retour à la board' }).click()
  await expect(page).toHaveURL('/')
  // Le lecteur est unique pour l'application : un son parti en admin jouerait encore.
  await expect(stopAll()).toBeDisabled()
})

test('plusieurs tags filtrent en intersection, et l\'état est dans l\'URL', async () => {
  await visit('/')

  await page.getByRole('button', { name: 'Blagues' }).click()
  await page.getByRole('button', { name: 'Cinéma' }).click()

  await expect(page).toHaveURL('/?tags=blagues&tags=cinema')
  expect(await gridNames()).toEqual(['Bravo'])

  await page.reload()
  await page.waitForLoadState('networkidle')

  expect(await gridNames()).toEqual(['Bravo'])
  await expect(page.getByRole('button', { name: 'Blagues' })).toHaveAttribute('aria-pressed', 'true')
})

test('la recherche est floue et sans accents ; aucun résultat se réinitialise', async () => {
  await visit('/')

  const search = page.getByLabel('Rechercher un son')

  await search.fill('brise')
  await expect(page).toHaveURL('/?q=brise')
  expect(await gridNames()).toEqual(['Verre brisé'])

  await search.fill('alpah')
  await expect.poll(gridNames).toEqual(['Alpha'])

  await search.fill('zzzzzz')
  await expect(page.locator('[data-state="no-results"]')).toBeVisible()

  await page.getByRole('button', { name: 'Réinitialiser la recherche et les filtres' }).click()
  await expect(page).toHaveURL('/')
  await expect(search).toHaveValue('')
  await expect.poll(async () => (await gridNames()).length).toBe(48)
})

test('la grille est paginée par 48, la page est dans l\'URL, un filtre ramène en page 1', async () => {
  await visit('/')

  await expect(page.getByRole('heading', { level: 2 })).toContainText('page 1 sur 2')
  expect(await gridNames()).toHaveLength(48)

  await page.getByRole('link', { name: 'Page 2' }).click()

  await expect(page).toHaveURL('/?page=2')
  await expect(page.getByRole('heading', { level: 2 })).toContainText('page 2 sur 2')
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused()
  expect(await gridNames()).toHaveLength(SOUNDS.length + FILLERS - 48)
  await expect(page.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: 'Blagues' }).click()

  await expect(page).toHaveURL('/?tags=blagues')
  await expect(page.getByRole('heading', { level: 2 })).toContainText('page 1 sur 1')
})

test('un son sans fichier est dit indisponible, sans gêner les autres', async () => {
  await visit('/?q=Remplissage%2000')

  await soundButton('Remplissage 00').click()

  await expect(soundButton('Remplissage 00')).toHaveAttribute('data-state', 'unavailable')
  await expect(soundButton('Remplissage 00')).toContainText('Indisponible')
})

test('le volume s\'applique et survit au rechargement', async () => {
  await visit('/')

  const volume = page.getByLabel('Volume')

  await volume.focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('output[for="board-volume"]')).toHaveText('90 %')

  // Le serveur ne voit pas le localStorage : le premier rendu client doit
  // tout de même coïncider avec le sien, filtres de l'URL compris.
  const warnings: string[] = []

  page.on('console', (message) => {
    if (/hydration/i.test(message.text())) {
      warnings.push(message.text())
    }
  })

  await page.goto('/?q=brise&tags=blagues&page=1')
  await page.waitForLoadState('networkidle')
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('output[for="board-volume"]')).toHaveText('90 %')
  expect(warnings).toEqual([])
})

test('le parcours complet se fait au clavier seul', async () => {
  await visit('/')
  await page.locator('body').press('Tab')

  // Chercher : « / » mène au champ.
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('/')
  await expect(page.getByLabel('Rechercher un son')).toBeFocused()
  await page.keyboard.type('brvo')
  await expect.poll(gridNames).toEqual(['Bravo'])

  // Filtrer : les tags sont des boutons à bascule.
  await tabTo(page.getByRole('button', { name: 'Cinéma' }))
  await page.keyboard.press('Space')
  await expect(page).toHaveURL(/tags=cinema/)

  // Régler le volume.
  await tabTo(page.getByLabel('Volume'))
  await page.keyboard.press('ArrowRight')

  // Jouer, au bouton puis au raccourci, et couper.
  await tabTo(soundButton('Bravo'))
  await page.keyboard.press('Enter')
  await page.keyboard.press('a')
  await expect(stopAll()).toHaveText('Tout couper (2 en cours)')
  await page.keyboard.press('Escape')
  await expect(stopAll()).toBeDisabled()

  // Réinitialiser, puis changer de page.
  await page.keyboard.press('/')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await tabTo(page.getByRole('button', { name: 'Cinéma' }))
  await page.keyboard.press('Space')
  await expect(page).toHaveURL('/')

  await tabTo(page.getByRole('link', { name: 'Page 2' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused()
  await expect(page).toHaveURL('/?page=2')

  // Changer de langue : la lettre choisit l'option, sans ouvrir la liste.
  await tabTo(page.getByLabel('Langue'), { backwards: true })
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Araponga')
  await expect(page.getByLabel('Search a sound')).toBeVisible()
})
