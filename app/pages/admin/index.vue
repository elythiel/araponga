<script setup lang="ts">
import type { AdminSound } from '#shared/catalog'

definePageMeta({ middleware: 'admin' })

const { t } = useI18n()

useHead({ title: () => `${t('admin.title')} — Araponga` })

const { sounds, status, refresh, upload, update, remove, reorder } = useAdminSounds()

const editingId = shallowRef<string | null>(null)
const editing = computed(() => sounds.value.find(sound => sound.id === editingId.value) ?? null)
/** Issue des actions de la liste, annoncée dans la région `status`. */
const message = shallowRef('')

function nameOf(id: string): string {
  return sounds.value.find(sound => sound.id === id)?.name ?? ''
}

async function onRemove(id: string) {
  const name = nameOf(id)

  if (!window.confirm(t('admin.sounds.confirmDelete', { name }))) {
    return
  }

  try {
    await remove(id)
    message.value = t('admin.sounds.deleted', { name })
  }
  catch {
    await refresh()
    message.value = t('admin.sounds.actionFailed')
  }
}

async function onReorder(ids: string[]) {
  try {
    await reorder(ids)
  }
  catch {
    message.value = t('admin.sounds.actionFailed')
  }
}

function onSaved(sound: AdminSound) {
  editingId.value = null
  message.value = t('admin.edit.saved', { name: sound.name })
}
</script>

<template>
  <main :data-state="status">
    <header>
      <h1>{{ t('admin.title') }}</h1>
      <NuxtLink to="/">
        {{ t('admin.backToBoard') }}
      </NuxtLink>
    </header>

    <AdminSoundUploadForm
      :sounds="sounds"
      :upload="upload"
    />

    <p v-if="status === 'pending' && sounds.length === 0">
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

    <AdminSoundTable
      v-else
      :sounds="sounds"
      @edit="editingId = $event"
      @remove="onRemove"
      @reorder="onReorder"
    />

    <p
      role="status"
      data-admin-status
    >
      {{ message }}
    </p>

    <AdminSoundEditDialog
      :sound="editing"
      :sounds="sounds"
      :update="update"
      @close="editingId = null"
      @saved="onSaved"
    />
  </main>
</template>
