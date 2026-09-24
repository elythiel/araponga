import { useOnline } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import type { CatalogSound } from '#shared/catalog'
import { AUDIO_CACHE } from '#shared/pwa'
import type { SoundPlayer } from './useSoundPlayer'

/**
 * Sons qui ne joueront pas faute de réseau, connus **avant** le clic : hors
 * ligne, un son n'est jouable que s'il est déjà décodé en mémoire ou dans le
 * cache audio du service worker. Seuls les sons affichés sont vérifiés
 * (une page, 48 au plus). En ligne, l'ensemble est vide.
 */
export function useOfflineAvailability(sounds: MaybeRefOrGetter<readonly CatalogSound[]>, player: SoundPlayer) {
  const online = useOnline()
  const offlineIds = shallowRef<ReadonlySet<string>>(new Set())

  watch([online, () => toValue(sounds)], async ([isOnline, current], _previous, onCleanup) => {
    let cancelled = false

    onCleanup(() => {
      cancelled = true
    })

    if (isOnline || typeof caches === 'undefined') {
      offlineIds.value = new Set()

      return
    }

    const cache = await caches.open(AUDIO_CACHE)
    const missing = await Promise.all(current.map(async sound =>
      player.isLoaded(sound) || await cache.match(sound.url) ? null : sound.id))

    if (!cancelled) {
      offlineIds.value = new Set(missing.filter(id => id !== null))
    }
  }, { immediate: true })

  return { online, offlineIds: readonly(offlineIds) }
}
