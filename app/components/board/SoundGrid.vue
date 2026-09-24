<script setup lang="ts">
import type { CatalogSound } from '#shared/catalog'

defineProps<{
  /** Sons de la page affichée. */
  sounds: readonly CatalogSound[]
  playingIds: ReadonlySet<string>
  failedIds: ReadonlySet<string>
  /** Hors ligne, sons ni en mémoire ni en cache : ils ne joueront pas. */
  offlineIds: ReadonlySet<string>
}>()

const emit = defineEmits<{
  play: [sound: CatalogSound]
}>()

const { t } = useI18n()

/**
 * Le nom accessible du bouton est le nom du son, seul ; la touche, les tags
 * et l'état passent par `aria-describedby`, pour ne pas alourdir l'annonce.
 */
type SoundState = 'offline' | 'unavailable' | undefined

/** « Hors ligne » prime : c'est la cause, un échec de chargement en découle. */
function stateOf(id: string, offline: ReadonlySet<string>, failed: ReadonlySet<string>): SoundState {
  return offline.has(id) ? 'offline' : failed.has(id) ? 'unavailable' : undefined
}

function describedBy(sound: CatalogSound, state: SoundState): string | undefined {
  const ids = [
    sound.hotkey && `sound-${sound.id}-key`,
    sound.tags.length > 0 && `sound-${sound.id}-tags`,
    state && `sound-${sound.id}-state`,
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
        :data-state="stateOf(sound.id, offlineIds, failedIds)"
        :aria-labelledby="`sound-${sound.id}-name`"
        :aria-describedby="describedBy(sound, stateOf(sound.id, offlineIds, failedIds))"
        :aria-keyshortcuts="sound.hotkey?.toUpperCase()"
        @click="emit('play', sound)"
      >
        <!-- En bloc : sans espace entre eux, les textes se colleraient à l'écran. -->
        <span
          :id="`sound-${sound.id}-name`"
          class="block"
        >{{ sound.name }}</span>
        <kbd
          v-if="sound.hotkey"
          :id="`sound-${sound.id}-key`"
          class="block"
        >{{ t('board.sound.key', { key: sound.hotkey.toUpperCase() }) }}</kbd>
        <span
          v-if="sound.tags.length > 0"
          :id="`sound-${sound.id}-tags`"
          class="block"
        >{{ t('board.sound.tags', { tags: sound.tags.map(tag => tag.name).join(', ') }) }}</span>
        <span
          v-if="stateOf(sound.id, offlineIds, failedIds)"
          :id="`sound-${sound.id}-state`"
          class="block"
        >{{ stateOf(sound.id, offlineIds, failedIds) === 'offline' ? t('board.sound.offline') : t('board.sound.unavailable') }}</span>
        <span
          v-else-if="playingIds.has(sound.id)"
          class="block"
        >{{ t('board.sound.playing') }}</span>
      </button>
    </li>
  </ul>
</template>
