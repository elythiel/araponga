<script setup lang="ts">
// Prérendue au build et servie par le service worker à `/admin` hors ligne :
// administrer sans réseau n'a pas de sens (docs/06-pwa-offline.md).
const { t } = useI18n()

useHead({ title: () => `${t('offline.title')} — Araponga` })
</script>

<template>
  <main data-state="offline">
    <h1>{{ t('offline.title') }}</h1>
    <p>{{ t('offline.message') }}</p>
    <p>
      <a
        href="/"
        class="inline-block min-h-11 min-w-11"
      >{{ t('offline.board') }}</a>
    </p>
  </main>
</template>
