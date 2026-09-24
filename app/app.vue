<script setup lang="ts">
// Sans `lang`, un lecteur d'écran lit le français avec une voix par défaut.
const i18nHead = useLocaleHead({ lang: true, dir: true, seo: false })

useHead({
  htmlAttrs: {
    lang: () => i18nHead.value.htmlAttrs?.lang,
    dir: () => i18nHead.value.htmlAttrs?.dir,
  },
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
