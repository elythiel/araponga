<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <!-- NuxtLink pose `aria-current="page"` sur l'écran courant. -->
  <nav :aria-label="t('admin.nav.label')">
    <ul>
      <li>
        <NuxtLink to="/admin">
          {{ t('admin.nav.sounds') }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/admin/tags">
          {{ t('admin.nav.tags') }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/admin/users">
          {{ t('admin.nav.users') }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/">
          {{ t('admin.backToBoard') }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
