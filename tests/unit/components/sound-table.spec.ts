import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import SoundTable from '~/components/admin/SoundTable.vue'
import type { AdminSound } from '../../../shared/catalog'
import { anAdminSound, useFrench } from './fixtures'

const alpha = anAdminSound({ name: 'Alpha', sizeBytes: 3000 })
const bravo = anAdminSound({ name: 'Bravo', sizeBytes: 1000 })
const charlie = anAdminSound({ name: 'Charlie', sizeBytes: 2000 })

/**
 * Parent minimal : il applique l'ordre émis, comme la page d'administration,
 * et garde la trace de chaque émission.
 */
async function mountTable(initial: AdminSound[] = [alpha, bravo, charlie]) {
  const emitted: string[][] = []
  const Host = defineComponent(() => {
    const sounds = shallowRef(initial)

    return () => h(SoundTable, {
      sounds: sounds.value,
      onReorder(ids: string[]) {
        emitted.push(ids)
        sounds.value = ids.map(id => initial.find(sound => sound.id === id)!)
      },
    })
  })

  const wrapper = await mountSuspended(Host, { attachTo: document.body })

  return { wrapper, emitted }
}

const names = (wrapper: Awaited<ReturnType<typeof mountTable>>['wrapper']) =>
  wrapper.findAll('tbody th').map(cell => cell.text())

const button = (id: string, action: string) =>
  document.querySelector<HTMLButtonElement>(`[data-sound-id="${id}"] [data-action="${action}"]`)!

describe('tableau des sons', () => {
  beforeEach(useFrench)

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('liste les sons dans l\'ordre de la board', async () => {
    const { wrapper } = await mountTable()

    expect(names(wrapper)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  describe('réordonnancement au clavier', () => {
    it('descend un son et garde le focus sur la ligne déplacée', async () => {
      const { wrapper, emitted } = await mountTable()

      button(alpha.id, 'down').focus()
      button(alpha.id, 'down').click()
      await vi.waitFor(() => expect(document.activeElement).toBe(button(alpha.id, 'down')))

      expect(emitted).toEqual([[bravo.id, alpha.id, charlie.id]])
      expect(names(wrapper)).toEqual(['Bravo', 'Alpha', 'Charlie'])
      expect(wrapper.find('[data-reorder-status]').text()).toContain('position 2 sur 3')
    })

    it('passe le focus sur l\'autre bouton en bout de liste', async () => {
      await mountTable()

      button(bravo.id, 'down').click()
      await vi.waitFor(() => expect(document.activeElement).toBe(button(bravo.id, 'up')))

      expect(button(bravo.id, 'down').disabled).toBe(true)
    })

    it('désactive monter en tête et descendre en fin de liste', async () => {
      await mountTable()

      expect(button(alpha.id, 'up').disabled).toBe(true)
      expect(button(charlie.id, 'down').disabled).toBe(true)
      expect(button(bravo.id, 'up').disabled).toBe(false)
    })
  })

  it('trie par colonne et bloque alors le réordonnancement, en l\'expliquant', async () => {
    const { wrapper } = await mountTable()
    const sizeHeader = wrapper.findAll('thead th').find(th => th.text().startsWith('Taille'))!

    await sizeHeader.find('button').trigger('click')

    expect(names(wrapper)).toEqual(['Bravo', 'Charlie', 'Alpha'])
    expect(sizeHeader.attributes('aria-sort')).toBe('ascending')
    expect(wrapper.find('#reorder-disabled').exists()).toBe(true)
    expect(wrapper.findAll('[data-action="up"], [data-action="down"]').every(b => b.attributes('disabled') !== undefined))
      .toBe(true)

    await sizeHeader.find('button').trigger('click')

    expect(names(wrapper)).toEqual(['Alpha', 'Charlie', 'Bravo'])
    expect(sizeHeader.attributes('aria-sort')).toBe('descending')
  })

  it('filtre par la recherche, sans accent ni casse', async () => {
    const { wrapper } = await mountTable([alpha, anAdminSound({ name: 'Verre brisé' })])

    await wrapper.find('input[type="search"]').setValue('BRISE')

    expect(names(wrapper)).toEqual(['Verre brisé'])
    expect(wrapper.find('#reorder-disabled').exists()).toBe(true)
  })

  it('distingue un catalogue vide d\'une recherche sans résultat', async () => {
    const empty = await mountTable([])

    expect(empty.wrapper.find('[data-state="empty"]').exists()).toBe(true)

    const filtered = await mountTable([alpha])

    await filtered.wrapper.find('input[type="search"]').setValue('zzz')

    expect(filtered.wrapper.find('[data-state="no-results"]').exists()).toBe(true)
  })
})
