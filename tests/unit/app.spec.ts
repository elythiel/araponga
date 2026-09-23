import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import IndexPage from '~/pages/index.vue'

// Test de fumée du socle : si celui-ci passe, la chaîne Vitest + Nuxt + Vue
// est correctement câblée.
describe('page d\'accueil', () => {
  it('rend la coquille de la board', async () => {
    const page = await mountSuspended(IndexPage)

    expect(page.find('h1').text()).toBe('Araponga')
  })
})
