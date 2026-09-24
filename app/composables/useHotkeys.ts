import { useEventListener } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import type { CatalogSound } from '#shared/catalog'

export interface HotkeyActions {
  play: (sound: CatalogSound) => void
  stopAll: () => void
  focusSearch: () => void
}

/** Le clavier sert à écrire : dans un champ, aucun raccourci ne s'applique. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable
    || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null
}

/**
 * Faut-il laisser la touche au navigateur ? Un modificateur (on ne vole pas
 * `Ctrl+A`), une touche maintenue (pas de rafale), un champ de saisie.
 */
export function isIgnored(event: KeyboardEvent): boolean {
  return event.defaultPrevented
    || event.repeat
    || event.ctrlKey
    || event.altKey
    || event.metaKey
    || isTypingTarget(event.target)
}

/**
 * Raccourcis de la board : la touche d'un son le joue, `Échap` coupe tout,
 * `/` mène à la recherche. Les touches portent sur tout le catalogue, pas
 * seulement sur la page affichée. L'écouteur vit et meurt avec le composant
 * qui appelle ce composable : l'administration n'en a jamais.
 */
export function useHotkeys(sounds: MaybeRefOrGetter<readonly CatalogSound[]>, actions: HotkeyActions): void {
  const byKey = computed(() => new Map(
    toValue(sounds).filter(sound => sound.hotkey).map(sound => [sound.hotkey!, sound]),
  ))

  useEventListener('keydown', (event: KeyboardEvent) => {
    if (isIgnored(event)) {
      return
    }

    if (event.key === 'Escape') {
      actions.stopAll()

      return
    }

    if (event.key === '/') {
      event.preventDefault()
      actions.focusSearch()

      return
    }

    // Les raccourcis sont stockés en minuscules : `F1` et `Maj+T` comptent.
    const sound = byKey.value.get(event.key.toLowerCase())

    if (sound) {
      // Une touche de fonction a souvent un sens pour le navigateur.
      event.preventDefault()
      actions.play(sound)
    }
  })
}
