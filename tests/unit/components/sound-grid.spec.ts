import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import SoundGrid from '~/components/board/SoundGrid.vue'
import type { CatalogSound } from '../../../shared/catalog'
import { useFrench } from './fixtures'

const tada: CatalogSound = {
  id: 'tada',
  name: 'Tada',
  description: null,
  url: '/media/tada.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 1000,
  hotkey: 'f1',
  position: 1000,
  tags: [{ id: 'b', name: 'Blagues', slug: 'blagues' }],
}
const plain: CatalogSound = { ...tada, id: 'plain', name: 'Simple', hotkey: null, tags: [] }

describe('grille de sons', () => {
  beforeEach(useFrench)

  it('fait du nom le nom accessible, et passe touche et tags par aria-describedby', async () => {
    const wrapper = await mountSuspended(SoundGrid, { props: { sounds: [tada], playingIds: new Set<string>(), failedIds: new Set<string>() } })
    const button = wrapper.find('button')

    expect(button.attributes('aria-labelledby')).toBe('sound-tada-name')
    expect(wrapper.find('#sound-tada-name').text()).toBe('Tada')
    expect(button.attributes('aria-describedby')).toBe('sound-tada-key sound-tada-tags')
    expect(button.attributes('aria-keyshortcuts')).toBe('F1')
    expect(wrapper.find('#sound-tada-key').text()).toBe('Touche F1')
    expect(wrapper.find('#sound-tada-tags').text()).toBe('Tags : Blagues')
  })

  it('n\'annonce ni touche ni tags quand il n\'y en a pas', async () => {
    const wrapper = await mountSuspended(SoundGrid, { props: { sounds: [plain], playingIds: new Set<string>(), failedIds: new Set<string>() } })
    const button = wrapper.find('button')

    expect(button.attributes('aria-describedby')).toBeUndefined()
    expect(button.attributes('aria-keyshortcuts')).toBeUndefined()
  })

  it('dit en texte qu\'un son joue ou qu\'il est indisponible', async () => {
    const wrapper = await mountSuspended(SoundGrid, {
      props: { sounds: [tada, plain], playingIds: new Set(['tada']), failedIds: new Set(['plain']) },
    })
    const [playing, failed] = wrapper.findAll('button')

    expect(playing!.attributes('data-playing')).toBeDefined()
    expect(playing!.text()).toContain('En cours')
    expect(failed!.attributes('data-state')).toBe('unavailable')
    expect(failed!.attributes('aria-describedby')).toBe('sound-plain-state')
    expect(failed!.text()).toContain('Indisponible')
  })

  it('émet le son cliqué', async () => {
    const wrapper = await mountSuspended(SoundGrid, { props: { sounds: [tada], playingIds: new Set<string>(), failedIds: new Set<string>() } })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('play')).toEqual([[tada]])
  })
})
