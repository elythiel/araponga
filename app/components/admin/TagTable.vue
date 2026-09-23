<script setup lang="ts">
import type { CatalogTag } from '#shared/catalog'

defineProps<{
  tags: readonly CatalogTag[]
}>()

const emit = defineEmits<{
  rename: [id: string]
  remove: [id: string]
}>()

const { t } = useI18n()
</script>

<template>
  <section aria-labelledby="tags-caption">
    <p
      v-if="tags.length === 0"
      data-state="empty"
    >
      {{ t('admin.tags.empty') }}
    </p>

    <table v-else>
      <caption id="tags-caption">
        {{ t('admin.tags.caption') }} — {{ t('admin.tags.count', tags.length) }}
      </caption>
      <thead>
        <tr>
          <th scope="col">
            {{ t('admin.tags.columns.name') }}
          </th>
          <th scope="col">
            {{ t('admin.tags.columns.slug') }}
          </th>
          <th scope="col">
            {{ t('admin.tags.columns.sounds') }}
          </th>
          <th scope="col">
            {{ t('admin.tags.columns.actions') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="tag in tags"
          :key="tag.id"
          :data-tag-id="tag.id"
          :data-orphan="tag.soundCount === 0"
        >
          <th scope="row">
            {{ tag.name }}
          </th>
          <td>{{ tag.slug }}</td>
          <td>
            {{ tag.soundCount }}
            <!-- L'état orphelin est dit en toutes lettres, pas seulement par un style. -->
            <span v-if="tag.soundCount === 0">{{ t('admin.tags.orphan') }}</span>
          </td>
          <td>
            <button
              type="button"
              data-action="rename"
              @click="emit('rename', tag.id)"
            >
              {{ t('admin.tags.rename', { name: tag.name }) }}
            </button>
            <button
              type="button"
              data-action="delete"
              @click="emit('remove', tag.id)"
            >
              {{ t('admin.tags.delete', { name: tag.name }) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
