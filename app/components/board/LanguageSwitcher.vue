<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()

type LocaleCode = typeof locale.value

function onChange(event: Event) {
  void setLocale((event.target as HTMLSelectElement).value as LocaleCode)
}
</script>

<template>
  <p>
    <label for="board-language">{{ t('board.language') }}</label>
    <select
      id="board-language"
      class="min-h-11"
      :value="locale"
      @change="onChange"
    >
      <option
        v-for="option in locales"
        :key="option.code"
        :value="option.code"
        :lang="option.language"
      >
        {{ option.name }}
      </option>
    </select>
  </p>
</template>
