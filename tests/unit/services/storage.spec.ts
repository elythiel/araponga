// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMediaStorage, mediaUrl, parseMediaFilename } from '../../../server/services/storage'
import type { MediaStorage } from '../../../server/services/storage'
import { HEADERS, audioFile } from '../server/audio-fixtures'

/** Découpe un contenu en morceaux, comme arrive un flux réseau. */
async function* chunksOf(content: Uint8Array, size = 7) {
  for (let offset = 0; offset < content.length; offset += size) {
    yield content.subarray(offset, offset + size)
  }
}

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

describe('stockage des médias', () => {
  let dataDir: string
  let storage: MediaStorage

  const tmpEntries = () => readdir(join(dataDir, 'media', '.tmp'))

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'araponga-storage-'))
    storage = createMediaStorage(dataDir)
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  describe('réception', () => {
    it('calcule checksum, taille et type au fil de l\'eau, en zone temporaire', async () => {
      const content = audioFile(HEADERS.ogg)

      const received = await storage.receive(chunksOf(content))

      expect(received.checksum).toBe(sha256(content))
      expect(received.sizeBytes).toBe(content.length)
      expect(received.type).toStrictEqual({ extension: 'ogg', mimeType: 'audio/ogg' })
      expect(received.tmpPath.startsWith(join(dataDir, 'media', '.tmp'))).toBe(true)
      expect(await readFile(received.tmpPath)).toEqual(Buffer.from(content))
    })

    it('lit la signature même découpée en morceaux d\'un octet', async () => {
      const received = await storage.receive(chunksOf(audioFile(HEADERS.webm), 1))

      expect(received.type?.extension).toBe('webm')
    })

    it('reçoit un fichier de type inconnu sans le typer', async () => {
      const received = await storage.receive(chunksOf(audioFile(HEADERS.zip)))

      expect(received.type).toBeNull()
    })

    it('ne laisse aucun fichier temporaire quand le flux échoue', async () => {
      async function* interrupted() {
        yield HEADERS.mp3Id3
        throw new Error('connexion perdue')
      }

      await expect(storage.receive(interrupted())).rejects.toThrow('connexion perdue')
      expect(await tmpEntries()).toEqual([])
    })
  })

  describe('publication', () => {
    it('déplace le fichier sous media/<xx>/<checksum>.<ext>', async () => {
      const content = audioFile(HEADERS.mp3Frame)
      const received = await storage.receive(chunksOf(content))

      const published = await storage.commit(received)
      const checksum = sha256(content)

      expect(published).toStrictEqual({ checksum, extension: 'mp3' })
      expect(await readFile(join(dataDir, 'media', checksum.slice(0, 2), `${checksum}.mp3`)))
        .toEqual(Buffer.from(content))
      expect(await tmpEntries()).toEqual([])
    })

    it('refuse de publier un fichier de type inconnu', async () => {
      const received = await storage.receive(chunksOf(audioFile(HEADERS.zip)))

      await expect(storage.commit(received)).rejects.toThrow()
    })

    it('abandonner un fichier reçu le supprime, deux fois sans erreur', async () => {
      const received = await storage.receive(chunksOf(audioFile(HEADERS.wav)))

      await storage.discard(received)
      await storage.discard(received)

      expect(await tmpEntries()).toEqual([])
    })
  })

  describe('localisation', () => {
    it('donne chemin et taille d\'un fichier publié', async () => {
      const content = audioFile(HEADERS.m4a, 4321)
      const published = await storage.commit(await storage.receive(chunksOf(content)))

      expect(await storage.locate(published)).toStrictEqual({
        path: join(dataDir, 'media', published.checksum.slice(0, 2), `${published.checksum}.m4a`),
        sizeBytes: content.length,
      })
    })

    it('renvoie null pour un fichier absent, sans que le dossier existe', async () => {
      expect(await storage.locate({ checksum: 'f'.repeat(64), extension: 'mp3' })).toBeNull()
    })
  })
})

describe('noms de fichiers publics', () => {
  const checksum = '3fa85f64'.repeat(8)

  it('mediaUrl et parseMediaFilename sont réciproques', () => {
    const url = mediaUrl({ checksum, extension: 'ogg' })

    expect(url).toBe(`/media/${checksum}.ogg`)
    expect(parseMediaFilename(url.slice('/media/'.length))).toStrictEqual({ checksum, extension: 'ogg' })
  })

  it.each([
    ['un checksum trop court', `${checksum.slice(1)}.mp3`],
    ['un checksum en majuscules', `${checksum.toUpperCase()}.mp3`],
    ['une extension non acceptée', `${checksum}.flac`],
    ['une extension en majuscules', `${checksum}.MP3`],
    ['une traversée de chemin', `../${checksum}.mp3`],
    ['un sous-dossier', `3f/${checksum}.mp3`],
    ['un fichier temporaire', '.tmp'],
    ['un suffixe', `${checksum}.mp3.bak`],
    ['un nom vide', ''],
  ])('refuse %s', (_, filename) => {
    expect(parseMediaFilename(filename)).toBeNull()
  })
})
