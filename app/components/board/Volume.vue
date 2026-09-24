<script setup lang="ts">
/** Volume global, de 0 à 1, appliqué à toutes les instances. */
const volume = defineModel<number>({ required: true })

const { t, n } = useI18n()
</script>

<template>
  <p>
    <label for="board-volume">{{ t('board.volume') }}</label>
    <input
      id="board-volume"
      v-model.number="volume"
      type="range"
      min="0"
      max="1"
      step="0.05"
      class="min-h-11"
    >
    <output for="board-volume">{{ n(volume, { style: 'percent' }) }}</output>
  </p>
</template>
