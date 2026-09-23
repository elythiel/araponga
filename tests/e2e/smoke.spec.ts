import { expect, test } from '@playwright/test'

// Test de fumée du socle : l'application se rend côté serveur et s'hydrate.
test('la page d\'accueil répond', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Araponga')
})
