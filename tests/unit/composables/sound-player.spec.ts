import { describe, expect, it, vi } from 'vitest'
import { createSoundPlayer } from '~/composables/useSoundPlayer'
import type { AudioEngine } from '~/utils/audio-engine'

interface FakeInstance {
  url: string
  stopped: boolean
  /** Fin naturelle du son. */
  end: () => void
}

/** Moteur factice : on voit chaque instance démarrée, et on maîtrise les chargements. */
function fakeEngine() {
  const instances: FakeInstance[] = []
  const unreachable = new Set<string>()
  const loaded = new Set<string>()
  let holdLoads: Promise<void> | null = null

  const engine: AudioEngine = {
    load: vi.fn(async (url: string) => {
      await holdLoads

      if (unreachable.has(url)) {
        throw new Error('404')
      }

      loaded.add(url)
    }),
    isLoaded: url => loaded.has(url),
    start: (url, onEnded) => {
      const instance = { url, stopped: false, end: onEnded }

      instances.push(instance)

      return () => {
        instance.stopped = true
        onEnded()
      }
    },
    setVolume: vi.fn(),
    unlock: vi.fn(),
  }

  return {
    engine,
    instances,
    unreachable,
    /** Suspend les chargements jusqu'à l'appel de la fonction renvoyée. */
    hold() {
      let release!: () => void

      holdLoads = new Promise<void>((resolve) => {
        release = resolve
      })

      return () => {
        holdLoads = null
        release()
      }
    },
  }
}

const tada = { id: 'tada', url: '/media/tada.mp3' }
const klaxon = { id: 'klaxon', url: '/media/klaxon.mp3' }

describe('lecteur de sons', () => {
  it('superpose deux sons différents et deux instances d\'un même son', async () => {
    const { engine, instances } = fakeEngine()
    const player = createSoundPlayer(engine)

    await player.play(tada)
    await player.play(klaxon)
    await player.play(tada)

    expect(instances.map(instance => instance.url)).toEqual([tada.url, klaxon.url, tada.url])
    expect(player.playingCount.value).toBe(3)
    expect([...player.playingIds.value].sort()).toEqual(['klaxon', 'tada'])
  })

  it('suit chaque instance : la fin de l\'une ne coupe pas l\'autre', async () => {
    const { engine, instances } = fakeEngine()
    const player = createSoundPlayer(engine)

    await player.play(tada)
    await player.play(tada)
    instances[0]!.end()

    expect(player.playingCount.value).toBe(1)
    expect(player.playingIds.value.has('tada')).toBe(true)

    instances[1]!.end()

    expect(player.playingCount.value).toBe(0)
    expect(player.playingIds.value.size).toBe(0)
  })

  it('« Tout couper » arrête toutes les instances et remet le compteur à zéro', async () => {
    const { engine, instances } = fakeEngine()
    const player = createSoundPlayer(engine)

    await player.play(tada)
    await player.play(klaxon)
    player.stopAll()

    expect(instances.every(instance => instance.stopped)).toBe(true)
    expect(player.playingCount.value).toBe(0)
  })

  it('un son encore en chargement ne part pas après « Tout couper »', async () => {
    const { engine, instances, hold } = fakeEngine()
    const player = createSoundPlayer(engine)
    const release = hold()
    const playing = player.play(tada)

    player.stopAll()
    release()
    await playing

    expect(instances).toEqual([])
    expect(player.playingCount.value).toBe(0)
  })

  it('un son introuvable est marqué indisponible, sans gêner les autres, et réessayé au clic suivant', async () => {
    const { engine, unreachable } = fakeEngine()
    const player = createSoundPlayer(engine)

    unreachable.add(tada.url)
    await player.play(tada)
    await player.play(klaxon)

    expect(player.failedIds.value.has('tada')).toBe(true)
    expect(player.playingCount.value).toBe(1)

    unreachable.delete(tada.url)
    await player.play(tada)

    expect(player.failedIds.value.has('tada')).toBe(false)
    expect(player.playingCount.value).toBe(2)
  })

  it('sait quels sons sont déjà en mémoire, donc jouables sans réseau', async () => {
    const { engine } = fakeEngine()
    const player = createSoundPlayer(engine)

    await player.play(tada)

    expect(player.isLoaded(tada)).toBe(true)
    expect(player.isLoaded(klaxon)).toBe(false)
  })

  it('transmet le volume au moteur', () => {
    const { engine } = fakeEngine()

    createSoundPlayer(engine).setVolume(0.3)

    expect(engine.setVolume).toHaveBeenCalledWith(0.3)
  })
})
