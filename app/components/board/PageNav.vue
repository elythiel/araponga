<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { pageWindow } from '~/utils/pagination'

const props = defineProps<{
  page: number
  pageCount: number
  /** Lien vers une page : de vrais liens, qui se partagent et s'ouvrent ailleurs. */
  link: (page: number) => RouteLocationRaw
}>()

const emit = defineEmits<{
  /** Une page a été choisie ici : la page déplace le focus sur la grille. */
  navigate: []
}>()

const { t } = useI18n()

const items = computed(() => pageWindow(props.page, props.pageCount))
</script>

<template>
  <nav :aria-label="t('board.pagination.label')">
    <ul>
      <li>
        <NuxtLink
          v-if="page > 1"
          class="inline-block min-h-11 min-w-11"
          :to="link(page - 1)"
          rel="prev"
          @click="emit('navigate')"
        >
          {{ t('board.pagination.previous') }}
        </NuxtLink>
      </li>
      <li
        v-for="(item, index) in items"
        :key="item === 'gap' ? `gap-${index}` : item"
      >
        <span
          v-if="item === 'gap'"
          aria-hidden="true"
        >…</span>
        <NuxtLink
          v-else
          class="inline-block min-h-11 min-w-11"
          :to="link(item)"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="t('board.pagination.page', { page: item })"
          @click="emit('navigate')"
        >
          {{ item }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          v-if="page < pageCount"
          class="inline-block min-h-11 min-w-11"
          :to="link(page + 1)"
          rel="next"
          @click="emit('navigate')"
        >
          {{ t('board.pagination.next') }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
