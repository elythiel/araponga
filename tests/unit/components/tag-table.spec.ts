import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import TagTable from '~/components/admin/TagTable.vue'
import { useFrench } from './fixtures'

const used = { id: crypto.randomUUID(), name: 'Blagues', slug: 'blagues', soundCount: 3 }
const orphan = { id: crypto.randomUUID(), name: 'Ambiances', slug: 'ambiances', soundCount: 0 }

describe('tableau des tags', () => {
  beforeEach(useFrench)

  it('signale les orphelins en toutes lettres', async () => {
    const wrapper = await mountSuspended(TagTable, { props: { tags: [orphan, used] } })

    expect(wrapper.find(`[data-tag-id="${orphan.id}"]`).attributes('data-orphan')).toBe('true')
    expect(wrapper.find(`[data-tag-id="${orphan.id}"]`).text()).toContain('Orphelin')
    expect(wrapper.find(`[data-tag-id="${used.id}"]`).text()).not.toContain('Orphelin')
  })

  it('émet renommage et suppression avec l\'identifiant du tag', async () => {
    const wrapper = await mountSuspended(TagTable, { props: { tags: [used] } })

    await wrapper.find('[data-action="rename"]').trigger('click')
    await wrapper.find('[data-action="delete"]').trigger('click')

    expect(wrapper.emitted('rename')).toEqual([[used.id]])
    expect(wrapper.emitted('remove')).toEqual([[used.id]])
  })
})
