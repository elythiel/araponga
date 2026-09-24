<script setup lang="ts">
const { t } = useI18n()

// Lue seulement ici, quand la board est vide : les visiteurs d'une board
// remplie ne déclenchent aucune lecture de session.
const { data: session } = useFetch('/api/auth/session', { key: 'board-session', server: false, lazy: true })

const isAdmin = computed(() => session.value?.user?.role === 'admin')
</script>

<template>
  <p data-state="empty">
    {{ t('board.empty.catalog') }}
    <NuxtLink
      v-if="isAdmin"
      to="/admin"
    >
      {{ t('board.empty.addSounds') }}
    </NuxtLink>
  </p>
</template>
