<script setup lang="ts">
import type { CatalogTag } from '#shared/catalog'

definePageMeta({ middleware: 'admin' })

const { t } = useI18n()

useHead({ title: () => `${t('admin.tags.title')} — Araponga` })

const { tags, status, refresh, create, rename, remove } = useAdminTags()

const renamingId = shallowRef<string | null>(null)
const renaming = computed(() => tags.value.find(tag => tag.id === renamingId.value) ?? null)
const message = shallowRef('')

function confirmDeletion(tag: CatalogTag, soundCount: number): boolean {
  return window.confirm(soundCount > 0
    ? t('admin.tags.confirmForce', { name: tag.name, count: soundCount }, soundCount)
    : t('admin.tags.confirmDelete', { name: tag.name }))
}

/** Nombre de sons annoncé par un `409 tag_in_use`, s'il en est un. */
function soundCountOf(error: unknown): number | null {
  const data = (error as { data?: { code?: string, details?: { soundCount?: unknown } } }).data

  return data?.code === 'tag_in_use' && typeof data.details?.soundCount === 'number' ? data.details.soundCount : null
}

/**
 * La confirmation cite le nombre de sons qui perdront le tag ; `force` n'est
 * envoyé qu'après elle. Si ce nombre a changé entre-temps, le serveur refuse
 * et la question est reposée avec le bon chiffre.
 */
async function onRemove(id: string) {
  const tag = tags.value.find(item => item.id === id)

  if (!tag || !confirmDeletion(tag, tag.soundCount)) {
    return
  }

  try {
    try {
      await remove(id, tag.soundCount > 0)
    }
    catch (error) {
      const soundCount = soundCountOf(error)

      if (soundCount === null) {
        throw error
      }

      if (!confirmDeletion(tag, soundCount)) {
        await refresh()

        return
      }

      await remove(id, true)
    }

    message.value = t('admin.tags.deleted', { name: tag.name })
  }
  catch {
    await refresh()
    message.value = t('admin.sounds.actionFailed')
  }
}

function onSaved(tag: CatalogTag) {
  renamingId.value = null
  message.value = t('admin.tags.renamed', { name: tag.name })
}
</script>

<template>
  <main :data-state="status">
    <header>
      <AdminNav />
      <h1>{{ t('admin.tags.title') }}</h1>
    </header>

    <AdminTagCreateForm :create="create" />

    <p v-if="status === 'pending' && tags.length === 0">
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

    <AdminTagTable
      v-else
      :tags="tags"
      @rename="renamingId = $event"
      @remove="onRemove"
    />

    <p
      role="status"
      data-admin-status
    >
      {{ message }}
    </p>

    <AdminTagRenameDialog
      :tag="renaming"
      :rename="rename"
      @close="renamingId = null"
      @saved="onSaved"
    />
  </main>
</template>
