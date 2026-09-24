<script setup lang="ts">
import type { CatalogSound } from '#shared/catalog'

defineProps<{
  /** Sons de la page affichée. */
  sounds: readonly CatalogSound[]
  playingIds: ReadonlySet<string>
  failedIds: ReadonlySet<string>
}>()

const emit = defineEmits<{
  play: [sound: CatalogSound]
}>()

const { t } = useI18n()

/**
 * Le nom accessible du bouton est le nom du son, seul ; la touche, les tags
 * et l'état passent par `aria-describedby`, pour ne pas alourdir l'annonce.
 */
function describedBy(sound: CatalogSound, failed: boolean): string | undefined {
  const ids = [
    sound.hotkey && `sound-${sound.id}-key`,
    sound.tags.length > 0 && `sound-${sound.id}-tags`,
    failed && `sound-${sound.id}-state`,
  ].filter(Boolean)

  return ids.length > 0 ? ids.join(' ') : undefined
}
</script>

<template>
  <ul data-sound-grid>
    <li
      v-for="sound in sounds"
      :key="sound.id"
    >
      <button
        type="button"
        class="min-h-11 min-w-11"
        :data-sound-id="sound.id"
        :data-playing="playingIds.has(sound.id) || undefined"
        :data-state="failedIds.has(sound.id) ? 'unavailable' : undefined"
        :aria-labelledby="`sound-${sound.id}-name`"
        :aria-describedby="describedBy(sound, failedIds.has(sound.id))"
        :aria-keyshortcuts="sound.hotkey?.toUpperCase()"
        @click="emit('play', sound)"
      >
        <span :id="`sound-${sound.id}-name`">{{ sound.name }}</span>
        <kbd
          v-if="sound.hotkey"
          :id="`sound-${sound.id}-key`"
        >{{ t('board.sound.key', { key: sound.hotkey.toUpperCase() }) }}</kbd>
        <span
          v-if="sound.tags.length > 0"
          :id="`sound-${sound.id}-tags`"
        >{{ t('board.sound.tags', { tags: sound.tags.map(tag => tag.name).join(', ') }) }}</span>
        <span
          v-if="failedIds.has(sound.id)"
          :id="`sound-${sound.id}-state`"
        >{{ t('board.sound.unavailable') }}</span>
        <span v-else-if="playingIds.has(sound.id)">{{ t('board.sound.playing') }}</span>
      </button>
    </li>
  </ul>
</template>
