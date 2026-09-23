import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import UserTable from '~/components/admin/UserTable.vue'
import type { AdminUser } from '../../../shared/catalog'
import { useFrench } from './fixtures'

function aUser(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: crypto.randomUUID(),
    name: 'Alice',
    email: null,
    role: 'user',
    createdAt: 1_700_000_000_000,
    lastLoginAt: null,
    ...overrides,
  }
}

const me = aUser({ name: 'Moi', role: 'admin' })
const colleague = aUser({ name: 'Collègue', role: 'admin' })
const guest = aUser({ name: 'Invité', email: 'invite@example.com' })

async function mountTable(users: AdminUser[]) {
  return mountSuspended(UserTable, { props: { users, currentUserId: me.id } })
}

const toggle = (wrapper: Awaited<ReturnType<typeof mountTable>>, id: string) =>
  wrapper.find(`[data-user-id="${id}"] [data-action="toggle-role"]`)

describe('tableau des comptes', () => {
  beforeEach(useFrench)

  it('désactive sa propre rétrogradation et en donne la raison à côté', async () => {
    const wrapper = await mountTable([me, colleague])
    const button = toggle(wrapper, me.id)
    const reason = wrapper.find(`#lock-${me.id}`)

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-describedby')).toBe(`lock-${me.id}`)
    expect(reason.text()).toContain('votre propre rôle')
  })

  it('laisse rétrograder un autre administrateur et promouvoir un utilisateur', async () => {
    const wrapper = await mountTable([me, colleague, guest])

    await toggle(wrapper, colleague.id).trigger('click')
    await toggle(wrapper, guest.id).trigger('click')

    expect(toggle(wrapper, colleague.id).text()).toBe('Rétrograder « Collègue » en utilisateur')
    expect(toggle(wrapper, guest.id).text()).toBe('Promouvoir « Invité » administrateur')
    expect(wrapper.emitted('setRole')).toEqual([[colleague.id, 'user'], [guest.id, 'admin']])
  })

  it('désactive la rétrogradation du dernier administrateur, en l\'expliquant', async () => {
    // Situation qu'on ne voit que si la session a perdu son rôle entre-temps.
    const lastAdmin = aUser({ name: 'Seul', role: 'admin' })
    const wrapper = await mountSuspended(UserTable, { props: { users: [lastAdmin, guest], currentUserId: guest.id } })

    expect(toggle(wrapper, lastAdmin.id).attributes('disabled')).toBeDefined()
    expect(wrapper.find(`#lock-${lastAdmin.id}`).text()).toContain('dernier administrateur')
  })

  it('affiche « Jamais » sans connexion, et marque le compte courant', async () => {
    const wrapper = await mountTable([me])

    expect(wrapper.find(`[data-user-id="${me.id}"]`).text()).toContain('Jamais')
    expect(wrapper.find(`[data-user-id="${me.id}"] th`).text()).toBe('Moi (vous)')
  })
})
