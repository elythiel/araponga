import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useHotkeys } from '~/composables/useHotkeys'
import type { CatalogSound } from '../../../shared/catalog'

function aSound(name: string, hotkey: string | null): CatalogSound {
  return { id: name, name, description: null, url: `/media/${name}.mp3`, mimeType: 'audio/mpeg', durationMs: null, hotkey, position: 0, tags: [] }
}

const tada = aSound('tada', 't')
const fanfare = aSound('fanfare', 'f1')

const mounted: Array<{ unmount: () => void }> = []

/** Page minimale qui branche les raccourcis, avec un champ de saisie. */
function mountBoard() {
  const actions = { play: vi.fn(), stopAll: vi.fn(), focusSearch: vi.fn() }
  const Board = defineComponent(() => {
    useHotkeys([tada, fanfare], actions)

    return () => h('div', [
      h('input', { id: 'champ' }),
      h('div', { id: 'editable', contenteditable: 'true' }),
      h('button', { id: 'bouton' }),
    ])
  })

  const wrapper = mount(Board, { attachTo: document.body })

  mounted.push(wrapper)

  return { wrapper, actions }
}

function press(key: string, options: KeyboardEventInit & { on?: string } = {}) {
  const target = options.on ? document.getElementById(options.on)! : document.body
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })

  target.dispatchEvent(event)

  return event
}

describe('raccourcis de la board', () => {
  // Une board restée montée garderait son écouteur, qui intercepterait les touches.
  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
    document.body.innerHTML = ''
  })

  it('joue le son d\'une touche, sans tenir compte de la casse', () => {
    const { actions } = mountBoard()

    press('t')
    press('T', { shiftKey: true })
    press('F1')

    expect(actions.play.mock.calls.map(([sound]) => sound.id)).toEqual(['tada', 'tada', 'fanfare'])
  })

  it('se déclenche quand le focus est sur un bouton de son', () => {
    const { actions } = mountBoard()

    press('t', { on: 'bouton' })

    expect(actions.play).toHaveBeenCalledOnce()
  })

  it('Échap coupe tout, / mène à la recherche sans taper le caractère', () => {
    const { actions } = mountBoard()

    press('Escape')
    const slash = press('/')

    expect(actions.stopAll).toHaveBeenCalledOnce()
    expect(actions.focusSearch).toHaveBeenCalledOnce()
    expect(slash.defaultPrevented).toBe(true)
  })

  it.each([
    ['dans un champ de saisie', { on: 'champ' }],
    ['dans un élément éditable', { on: 'editable' }],
    ['avec Ctrl', { ctrlKey: true }],
    ['avec Alt', { altKey: true }],
    ['avec Meta', { metaKey: true }],
    ['sur une touche maintenue', { repeat: true }],
  ])('ne se déclenche pas %s', (_, options) => {
    const { actions } = mountBoard()

    press('t', options)
    press('Escape', options)
    press('/', options)

    expect(actions.play).not.toHaveBeenCalled()
    expect(actions.stopAll).not.toHaveBeenCalled()
    expect(actions.focusSearch).not.toHaveBeenCalled()
  })

  it('ignore une touche qui n\'est assignée à aucun son', () => {
    const { actions } = mountBoard()
    const event = press('z')

    expect(actions.play).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('disparaît avec la board : ailleurs (administration), plus aucun raccourci', () => {
    const { wrapper, actions } = mountBoard()

    wrapper.unmount()
    press('t')
    press('Escape')

    expect(actions.play).not.toHaveBeenCalled()
    expect(actions.stopAll).not.toHaveBeenCalled()
  })
})
