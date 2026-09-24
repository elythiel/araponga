import type { Ref } from 'vue'
import { createHtmlAudioEngine, createWebAudioEngine } from '~/utils/audio-engine'
import type { AudioEngine } from '~/utils/audio-engine'

/** Ce qu'il faut d'un son pour le jouer. */
export interface PlayableSound {
  id: string
  url: string
}

export interface SoundPlayer {
  /** Joue une nouvelle instance, en plus de celles qui jouent déjà. */
  play: (sound: PlayableSound) => Promise<void>
  /** Coupe toutes les instances, y compris celles encore en chargement. */
  stopAll: () => void
  setVolume: (volume: number) => void
  /** Le son est-il déjà en mémoire, donc jouable sans réseau ? */
  isLoaded: (sound: PlayableSound) => boolean
  playingCount: Readonly<Ref<number>>
  /** Sons ayant au moins une instance en cours. */
  playingIds: Readonly<Ref<ReadonlySet<string>>>
  /** Sons dont le dernier chargement a échoué. */
  failedIds: Readonly<Ref<ReadonlySet<string>>>
}

interface Instance {
  key: number
  soundId: string
  stop: () => void
}

/**
 * Lecteur polyphonique : chaque lecture est une instance suivie à part, pour
 * que « Tout couper » les arrête toutes. Indépendant du moteur audio.
 */
export function createSoundPlayer(engine: AudioEngine): SoundPlayer {
  const instances = shallowRef<readonly Instance[]>([])
  const failedIds = shallowRef<ReadonlySet<string>>(new Set())
  let nextKey = 0
  /** Change à chaque « Tout couper » : un son encore en chargement ne partira pas. */
  let generation = 0

  function remove(key: number) {
    instances.value = instances.value.filter(instance => instance.key !== key)
  }

  function markFailed(id: string, failed: boolean) {
    if (failedIds.value.has(id) === failed) {
      return
    }

    const next = new Set(failedIds.value)

    if (failed) {
      next.add(id)
    }
    else {
      next.delete(id)
    }

    failedIds.value = next
  }

  async function play(sound: PlayableSound) {
    const startedIn = generation

    try {
      await engine.load(sound.url)
    }
    catch {
      // Le bouton le dira ; le reste de la board continue de jouer.
      markFailed(sound.id, true)

      return
    }

    markFailed(sound.id, false)

    if (startedIn !== generation) {
      return
    }

    const key = nextKey++
    const stop = engine.start(sound.url, () => remove(key))

    instances.value = [...instances.value, { key, soundId: sound.id, stop }]
  }

  function stopAll() {
    generation++

    const current = instances.value

    instances.value = []

    for (const instance of current) {
      instance.stop()
    }
  }

  return {
    play,
    stopAll,
    setVolume: engine.setVolume,
    isLoaded: sound => engine.isLoaded(sound.url),
    playingCount: computed(() => instances.value.length),
    playingIds: computed(() => new Set(instances.value.map(instance => instance.soundId))),
    failedIds: readonly(failedIds),
  }
}

let shared: SoundPlayer | undefined

/** Moteur inerte du rendu serveur : rien n'y joue jamais. */
const SERVER_ENGINE: AudioEngine = {
  load: () => Promise.reject(new Error('Pas de son côté serveur.')),
  isLoaded: () => false,
  start: () => () => {},
  setVolume: () => {},
  unlock: () => {},
}

/**
 * Le lecteur de l'application : un seul, donc un seul `AudioContext`. La
 * sortie audio est débloquée au premier `pointerdown` (ou `keydown`) sur le
 * document, pas au premier clic sur un son, qui serait sinon perdu sur iOS.
 */
export function useSoundPlayer(): SoundPlayer {
  if (import.meta.server) {
    return createSoundPlayer(SERVER_ENGINE)
  }

  if (!shared) {
    const engine = typeof AudioContext === 'undefined' ? createHtmlAudioEngine() : createWebAudioEngine()

    shared = createSoundPlayer(engine)

    for (const type of ['pointerdown', 'keydown'] as const) {
      document.addEventListener(type, engine.unlock, { capture: true, passive: true })
    }
  }

  return shared
}
