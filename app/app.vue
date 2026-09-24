<script setup lang="ts">
// Sans `lang`, un lecteur d'écran lit le français avec une voix par défaut.
const i18nHead = useLocaleHead({ lang: true, dir: true, seo: false })

useHead({
  htmlAttrs: {
    lang: () => i18nHead.value.htmlAttrs?.lang,
    dir: () => i18nHead.value.htmlAttrs?.dir,
  },
  // Installation sur iOS, qui ignore une partie du manifest.
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: 'Araponga' },
  ],
})
</script>

<template>
  <NuxtPwaManifest />
  <NuxtPwaAssets />
  <NuxtRouteAnnouncer />
  <UpdateBanner />
  <NuxtPage />
</template>
