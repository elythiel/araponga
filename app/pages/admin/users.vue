<script setup lang="ts">
import type { UserRole } from '#shared/schemas/user'
import { issuesFromError } from '~/utils/form-errors'

definePageMeta({ middleware: 'admin' })

const { t, te } = useI18n()

useHead({ title: () => `${t('admin.users.title')} — Araponga` })

const { users, currentUserId, status, refresh, setRole } = useAdminUsers()

const message = shallowRef('')

async function onSetRole(id: string, role: UserRole) {
  try {
    const user = await setRole(id, role)

    message.value = t('admin.users.updated', {
      name: user.name ?? user.email ?? t('admin.users.anonymous'),
      role: t(`admin.users.roles.${user.role}`),
    })
  }
  catch (error) {
    // `self_demotion` ou `last_admin` si l'état a changé depuis l'affichage.
    const [issue] = issuesFromError(error)
    const key = `errors.${issue?.code}`

    message.value = te(key) ? t(key) : t('errors.unknown')
  }
}
</script>

<template>
  <main :data-state="status">
    <header>
      <AdminNav />
      <h1>{{ t('admin.users.title') }}</h1>
    </header>

    <p v-if="status === 'pending' && users.length === 0">
      {{ t('admin.loading') }}
    </p>

    <p v-else-if="status === 'error'">
      {{ t('admin.loadError') }}
      <button
        type="button"
        @click="refresh()"
      >
        {{ t('admin.retry') }}
      </button>
    </p>

    <AdminUserTable
      v-else
      :users="users"
      :current-user-id="currentUserId"
      @set-role="onSetRole"
    />

    <p
      role="status"
      data-admin-status
    >
      {{ message }}
    </p>
  </main>
</template>
