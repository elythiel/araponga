import type { CatalogTag } from '#shared/catalog'

/** Typée `string` : la forme littérale serait confondue avec d'autres routes typées. */
function tagUrl(id: string, force = false): string {
  return `/api/admin/tags/${encodeURIComponent(id)}${force ? '?force=true' : ''}`
}

/** Tags de l'administration ; chaque mutation recharge la liste depuis le serveur. */
export function useAdminTags() {
  const { data, status, refresh } = useFetch<CatalogTag[]>('/api/admin/tags', { key: 'admin-tags' })

  const tags = computed(() => data.value ?? [])

  /** `created` est faux quand le slug existait : le serveur renvoie alors le tag existant, en 200. */
  async function create(name: string): Promise<{ tag: CatalogTag, created: boolean }> {
    const response = await $fetch.raw<CatalogTag>('/api/admin/tags', { method: 'POST', body: { name } })

    await refresh()

    return { tag: response._data!, created: response.status === 201 }
  }

  async function rename(id: string, name: string): Promise<CatalogTag> {
    const tag = await $fetch<CatalogTag>(tagUrl(id), { method: 'PATCH', body: { name } })

    await refresh()

    return tag
  }

  /** Sans `force`, un tag encore utilisé est refusé en `409 tag_in_use`. */
  async function remove(id: string, force: boolean): Promise<void> {
    await $fetch(tagUrl(id, force), { method: 'DELETE' })
    await refresh()
  }

  return { tags, status, refresh, create, rename, remove }
}
