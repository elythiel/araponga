<script setup lang="ts">
import type { CatalogTag } from '#shared/catalog'

defineProps<{
  tags: readonly CatalogTag[]
  selected: readonly string[]
}>()

const emit = defineEmits<{
  toggle: [slug: string]
}>()

const { t } = useI18n()
</script>

<template>
  <fieldset v-if="tags.length > 0">
    <legend>{{ t('board.tags.legend') }}</legend>
    <p id="board-tags-hint">
      {{ t('board.tags.hint') }}
    </p>
    <ul>
      <li
        v-for="tag in tags"
        :key="tag.id"
      >
        <button
          type="button"
          class="min-h-11 min-w-11"
          :aria-pressed="selected.includes(tag.slug)"
          aria-describedby="board-tags-hint"
          :data-tag="tag.slug"
          @click="emit('toggle', tag.slug)"
        >
          {{ tag.name }}
        </button>
      </li>
    </ul>
  </fieldset>
</template>
