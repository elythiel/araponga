<script setup lang="ts">
import type { AdminUser } from '#shared/catalog'
import type { UserRole } from '#shared/schemas/user'
import { formatDateTime } from '~/utils/format'

const props = defineProps<{
  users: readonly AdminUser[]
  /** Compte de qui administre : il ne peut pas se rétrograder. */
  currentUserId: string | null
}>()

const emit = defineEmits<{
  setRole: [id: string, role: UserRole]
}>()

const { t, locale } = useI18n()

const adminCount = computed(() => props.users.filter(user => user.role === 'admin').length)

/**
 * Pourquoi la bascule est interdite, dans l'ordre où le serveur refuserait.
 * Le contrôle est désactivé **et** la raison affichée à côté.
 */
function lockReason(user: AdminUser): string | null {
  if (user.role !== 'admin') {
    return null
  }

  if (user.id === props.currentUserId) {
    return t('admin.users.selfDemotion')
  }

  return adminCount.value <= 1 ? t('admin.users.lastAdmin') : null
}

const rows = computed(() => props.users.map(user => ({
  user,
  displayName: user.name ?? user.email ?? t('admin.users.anonymous'),
  lockReason: lockReason(user),
})))
</script>

<template>
  <table>
    <caption>
      {{ t('admin.users.caption') }} — {{ t('admin.users.count', users.length) }}
    </caption>
    <thead>
      <tr>
        <th scope="col">
          {{ t('admin.users.columns.name') }}
        </th>
        <th scope="col">
          {{ t('admin.users.columns.email') }}
        </th>
        <th scope="col">
          {{ t('admin.users.columns.role') }}
        </th>
        <th scope="col">
          {{ t('admin.users.columns.lastLogin') }}
        </th>
        <th scope="col">
          {{ t('admin.users.columns.actions') }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="{ user, displayName, lockReason: reason } in rows"
        :key="user.id"
        :data-user-id="user.id"
        :data-role="user.role"
        :data-current="user.id === currentUserId"
      >
        <th scope="row">
          {{ displayName }}
          <template v-if="user.id === currentUserId">
            {{ t('admin.users.you') }}
          </template>
        </th>
        <td>{{ user.email ?? t('admin.users.none') }}</td>
        <td>{{ t(`admin.users.roles.${user.role}`) }}</td>
        <td>{{ user.lastLoginAt === null ? t('admin.users.never') : formatDateTime(user.lastLoginAt, locale) }}</td>
        <td>
          <button
            type="button"
            data-action="toggle-role"
            :disabled="reason !== null"
            :aria-describedby="reason ? `lock-${user.id}` : undefined"
            @click="emit('setRole', user.id, user.role === 'admin' ? 'user' : 'admin')"
          >
            {{ user.role === 'admin'
              ? t('admin.users.demote', { name: displayName })
              : t('admin.users.promote', { name: displayName }) }}
          </button>
          <p
            v-if="reason"
            :id="`lock-${user.id}`"
            data-lock-reason
          >
            {{ reason }}
          </p>
        </td>
      </tr>
    </tbody>
  </table>
</template>
