<script setup lang="ts">
/** Champ de recherche de la board ; `/` y mène depuis n'importe où (hors champ). */
const search = defineModel<string>({ required: true })

const { t } = useI18n()
</script>

<template>
  <p>
    <label for="board-search">{{ t('board.search.label') }}</label>
    <input
      id="board-search"
      v-model="search"
      type="search"
      autocomplete="off"
      aria-keyshortcuts="/"
      aria-describedby="board-search-hint"
    >
    <small id="board-search-hint">{{ t('board.search.hint') }}</small>
  </p>
</template>
