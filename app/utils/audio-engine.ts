/**
 * Ce que le lecteur attend d'un moteur audio. Deux implémentations : Web Audio
 * (la norme) et `HTMLAudioElement` (le repli). Le lecteur ne sait rien de
 * l'une ni de l'autre, ce qui le rend testable avec un moteur factice.
 */
export interface AudioEngine {
  /** Prépare un son ; la promesse échoue si le fichier est inaccessible ou illisible. */
  load: (url: string) => Promise<void>
  /** Le son est-il déjà prêt, jouable sans réseau ? */
  isLoaded: (url: string) => boolean
  /** Démarre une instance d'un son chargé. `onEnded` est appelé à sa fin, naturelle ou non. */
  start: (url: string, onEnded: () => void) => () => void
  setVolume: (volume: number) => void
  /** Débloque la sortie audio ; à appeler depuis une interaction utilisateur. */
  unlock: () => void
}

/**
 * Web Audio : un seul `AudioContext` pour toute l'application, créé au premier
 * besoin, et un gain global pour le volume. Chaque son est téléchargé puis
 * décodé une seule fois ; le tampon décodé reste en mémoire pour la session.
 * Le cache HTTP (`/media` est immuable) évite, lui, les re-téléchargements.
 */
export function createWebAudioEngine(Context: typeof AudioContext = AudioContext): AudioEngine {
  let context: AudioContext | undefined
  let gain: GainNode | undefined
  let volume = 1
  const pending = new Map<string, Promise<AudioBuffer>>()
  const decoded = new Map<string, AudioBuffer>()

  function output() {
    if (!context || !gain) {
      context = new Context()
      gain = context.createGain()
      gain.gain.value = volume
      gain.connect(context.destination)
    }

    return { context, gain }
  }

  function load(url: string): Promise<void> {
    if (decoded.has(url)) {
      return Promise.resolve()
    }

    let decoding = pending.get(url)

    if (!decoding) {
      decoding = fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`${url} : ${response.status}`)
          }

          return response.arrayBuffer()
        })
        .then(bytes => output().context.decodeAudioData(bytes))
        .then((buffer) => {
          decoded.set(url, buffer)

          return buffer
        })
        .finally(() => pending.delete(url))

      pending.set(url, decoding)
    }

    return decoding.then(() => {})
  }

  function start(url: string, onEnded: () => void): () => void {
    const { context: ctx, gain: master } = output()
    const source = ctx.createBufferSource()

    source.buffer = decoded.get(url) ?? null
    source.connect(master)
    source.onended = () => {
      source.disconnect()
      onEnded()
    }

    // Un contexte encore suspendu (autoplay) repart ici, au pire.
    void ctx.resume()
    source.start()

    return () => source.stop()
  }

  function setVolume(next: number) {
    volume = next

    if (gain) {
      gain.gain.value = next
    }
  }

  /**
   * iOS ne laisse sortir le son qu'après une interaction : reprendre le
   * contexte et jouer un échantillon muet, au premier geste sur la page.
   */
  function unlock() {
    const { context: ctx } = output()

    if (ctx.state !== 'running') {
      void ctx.resume()

      const silence = ctx.createBufferSource()

      silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      silence.connect(ctx.destination)
      silence.start()
    }
  }

  return { load, isLoaded: url => decoded.has(url), start, setVolume, unlock }
}

/**
 * Repli sans Web Audio : un élément `<audio>` par instance. Moins précis
 * (latence, et Safari iOS ignore `volume`), mais la polyphonie tient.
 */
export function createHtmlAudioEngine(): AudioEngine {
  let volume = 1
  const ready = new Map<string, Promise<void>>()
  const loaded = new Set<string>()
  const playing = new Set<HTMLAudioElement>()

  function load(url: string): Promise<void> {
    let loading = ready.get(url)

    if (!loading) {
      loading = new Promise<void>((resolve, reject) => {
        const probe = new Audio()

        probe.preload = 'auto'
        probe.oncanplaythrough = () => {
          loaded.add(url)
          resolve()
        }
        probe.onerror = () => reject(new Error(`${url} : illisible`))
        probe.src = url
      })

      // Un échec n'est pas gardé : le prochain clic réessaie.
      loading.catch(() => ready.delete(url))
      ready.set(url, loading)
    }

    return loading
  }

  function start(url: string, onEnded: () => void): () => void {
    const audio = new Audio(url)
    let done = false

    const finish = () => {
      if (!done) {
        done = true
        playing.delete(audio)
        onEnded()
      }
    }

    audio.volume = volume
    audio.onended = finish
    playing.add(audio)
    audio.play().catch(finish)

    return () => {
      audio.pause()
      finish()
    }
  }

  function setVolume(next: number) {
    volume = next

    for (const audio of playing) {
      audio.volume = next
    }
  }

  return { load, isLoaded: url => loaded.has(url), start, setVolume, unlock: () => {} }
}
