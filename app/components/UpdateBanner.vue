<script setup lang="ts">
/**
 * Une nouvelle version attend : on le dit, on ne recharge pas. Couper un son
 * parce qu'un déploiement vient de passer serait le pire moment.
 */
const { t } = useI18n()
const { $pwa } = useNuxtApp()
</script>

<template>
  <p
    v-if="$pwa?.needRefresh"
    role="status"
    data-update-banner
  >
    {{ t('pwa.updateAvailable') }}
    <button
      type="button"
      class="min-h-11 min-w-11"
      @click="$pwa.updateServiceWorker()"
    >
      {{ t('pwa.reload') }}
    </button>
  </p>
</template>
