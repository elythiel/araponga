import type { AdminCatalog, AdminSound } from '#shared/catalog'
import type { InferInput } from 'valibot'
import type { SoundUpdateSchema } from '#shared/schemas/sound'

export type SoundPatch = InferInput<typeof SoundUpdateSchema>

/**
 * Typée `string` exprès : sous sa forme littérale, le typage des routes Nitro
 * confondrait `/api/admin/sounds/${id}` avec `/api/admin/sounds/order`.
 */
function soundUrl(id: string): string {
  return `/api/admin/sounds/${encodeURIComponent(id)}`
}

/**
 * Catalogue de l'administration et ses mutations. Chaque mutation recharge
 * la liste depuis le serveur, seule source de vérité — sauf le
 * réordonnancement, appliqué d'abord localement pour que la ligne déplacée
 * garde le focus, puis annulé par un rechargement si le serveur refuse.
 */
export function useAdminSounds() {
  const { data, status, refresh } = useFetch<AdminCatalog>('/api/admin/sounds', { key: 'admin-sounds' })

  const sounds = computed(() => data.value?.sounds ?? [])
  const tags = computed(() => data.value?.tags ?? [])

  async function upload(form: FormData): Promise<AdminSound> {
    const sound = await $fetch<AdminSound>('/api/admin/sounds', { method: 'POST', body: form })

    await refresh()

    return sound
  }

  async function update(id: string, patch: SoundPatch): Promise<AdminSound> {
    const sound = await $fetch<AdminSound>(soundUrl(id), { method: 'PATCH', body: patch })

    await refresh()

    return sound
  }

  async function remove(id: string): Promise<void> {
    await $fetch(soundUrl(id), { method: 'DELETE' })
    await refresh()
  }

  async function reorder(ids: string[]): Promise<void> {
    if (data.value) {
      const byId = new Map(data.value.sounds.map(sound => [sound.id, sound]))

      data.value = { ...data.value, sounds: ids.map(id => byId.get(id)!).filter(Boolean) }
    }

    try {
      await $fetch('/api/admin/sounds/order', { method: 'PATCH', body: { ids } })
    }
    catch (error) {
      await refresh()
      throw error
    }
  }

  return { sounds, tags, status, refresh, upload, update, remove, reorder }
}
