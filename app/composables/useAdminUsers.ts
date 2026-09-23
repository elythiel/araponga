import type { AdminUser } from '#shared/catalog'
import type { UserRole } from '#shared/schemas/user'

function userUrl(id: string): string {
  return `/api/admin/users/${encodeURIComponent(id)}`
}

/** Comptes de l'administration, et l'identité de qui les administre. */
export function useAdminUsers() {
  const { data, status, refresh } = useFetch<AdminUser[]>('/api/admin/users', { key: 'admin-users' })
  const { data: session } = useFetch('/api/auth/session', { key: 'admin-session' })

  const users = computed(() => data.value ?? [])
  const currentUserId = computed(() => session.value?.user?.id ?? null)

  async function setRole(id: string, role: UserRole): Promise<AdminUser> {
    try {
      return await $fetch<AdminUser>(userUrl(id), { method: 'PATCH', body: { role } })
    }
    finally {
      // Succès comme refus : la liste affichée doit refléter la base.
      await refresh()
    }
  }

  return { users, currentUserId, status, refresh, setRole }
}
