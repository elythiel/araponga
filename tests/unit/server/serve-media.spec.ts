// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, eventHandler, toWebHandler } from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import apiErrorHandler from '../../../server/error'
import { sounds } from '../../../server/database/schema'
import { getCatalog } from '../../../server/services/catalog'
import { createMediaStorage } from '../../../server/services/storage'
import type { MediaStorage } from '../../../server/services/storage'
import { serveMedia } from '../../../server/utils/serve-media'
import type { Catalog } from '../../../shared/catalog'
import { aSound, createTestDatabase } from '../database/helpers'
import { HEADERS, audioFile } from './audio-fixtures'

/** Les deux routes publiques, montées comme Nitro les monte, erreurs comprises. */
function serve(storage: Pick<MediaStorage, 'locate'>, catalog?: () => Promise<Catalog>) {
  const router = createRouter()
    .get('/media/:filename', eventHandler(event => serveMedia(event, storage)))

  if (catalog) {
    router.get('/api/sounds', eventHandler(catalog))
  }

  const app = createApp({
    onError: (error, event) => apiErrorHandler(error, event, {
      defaultHandler: () => {
        throw new Error('Le gestionnaire de Nitro n\'est pas branché dans ce test.')
      },
    }),
  }).use(router)

  const fetch = toWebHandler(app)

  return (path: string, headers: Record<string, string> = {}) =>
    fetch(new Request(new URL(path, 'http://localhost'), { headers }))
}

const CONTENT = audioFile(HEADERS.mp3Id3, 2000)
const CHECKSUM = createHash('sha256').update(CONTENT).digest('hex')
const URL_PATH = `/media/${CHECKSUM}.mp3`

describe('GET /media/:filename', () => {
  let dataDir: string
  let request: ReturnType<typeof serve>
  const connection = createTestDatabase()

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'araponga-media-'))

    // Dépôt manuel, sans passer par le service : une ligne en base, un
    // fichier rangé à la main dans l'arborescence.
    connection.db.insert(sounds).values(aSound({ checksum: CHECKSUM, extension: 'mp3' })).run()
    await mkdir(join(dataDir, 'media', CHECKSUM.slice(0, 2)), { recursive: true })
    await writeFile(join(dataDir, 'media', CHECKSUM.slice(0, 2), `${CHECKSUM}.mp3`), CONTENT)

    request = serve(
      createMediaStorage(dataDir),
      () => getCatalog(connection.db, { tags: [] }),
    )
  })

  afterAll(async () => {
    connection.sqlite.close()
    await rm(dataDir, { recursive: true, force: true })
  })

  it('sert un fichier déposé en base et sur disque, avec les en-têtes de cache immuable', async () => {
    const catalog = (await (await request('/api/sounds')).json()) as Catalog

    expect(catalog.sounds[0]?.url).toBe(URL_PATH)

    const response = await request(URL_PATH)

    expect(response.status).toBe(200)
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'cache-control': 'public, max-age=31536000, immutable',
      'etag': `"${CHECKSUM}"`,
      'accept-ranges': 'bytes',
      'content-type': 'audio/mpeg',
      'content-length': String(CONTENT.length),
    })
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(CONTENT)
  })

  it('répond 304 sans corps quand le client a déjà cette version', async () => {
    const response = await request(URL_PATH, { 'if-none-match': `W/"${CHECKSUM}"` })

    expect(response.status).toBe(304)
    expect(response.headers.get('etag')).toBe(`"${CHECKSUM}"`)
    expect(await response.text()).toBe('')
  })

  describe('requêtes Range', () => {
    it('renvoie 206 avec exactement le fragment demandé', async () => {
      const response = await request(URL_PATH, { range: 'bytes=100-199' })

      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe(`bytes 100-199/${CONTENT.length}`)
      expect(response.headers.get('content-length')).toBe('100')
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(CONTENT.subarray(100, 200))
    })

    it('sert la fin du fichier sur une plage ouverte', async () => {
      const response = await request(URL_PATH, { range: 'bytes=-50' })

      expect(response.status).toBe(206)
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(CONTENT.subarray(-50))
    })

    it('répond 416 à une plage hors du fichier', async () => {
      const response = await request(URL_PATH, { range: `bytes=${CONTENT.length}-` })

      expect(response.status).toBe(416)
      expect(response.headers.get('content-range')).toBe(`bytes */${CONTENT.length}`)
    })

    it('sert le fichier entier quand If-Range ne correspond pas', async () => {
      const response = await request(URL_PATH, { 'range': 'bytes=0-9', 'if-range': '"autre"' })

      expect(response.status).toBe(200)
      expect((await response.arrayBuffer()).byteLength).toBe(CONTENT.length)
    })
  })

  it('répond 404 normalisée à un nom valide absent du disque', async () => {
    const response = await request(`/media/${'0'.repeat(64)}.ogg`)

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ statusCode: 404, code: 'not_found' })
  })
})

describe('nom de fichier hors format', () => {
  const locate = vi.fn<MediaStorage['locate']>()
  const request = serve({ locate })

  it.each([
    ['une extension refusée', `/media/${CHECKSUM}.flac`],
    ['un checksum en majuscules', `/media/${CHECKSUM.toUpperCase()}.mp3`],
    ['un checksum tronqué', `/media/${CHECKSUM.slice(2)}.mp3`],
    ['une traversée de chemin encodée', `/media/..%2F..%2Faraponga.db`],
    ['le dossier temporaire', '/media/.tmp'],
  ])('%s renvoie 404 sans accès disque', async (_, path) => {
    const response = await request(path)

    // Le code prouve que la route a répondu, et pas le routeur faute de correspondance.
    expect(await response.json()).toMatchObject({ statusCode: 404, code: 'not_found' })
    expect(locate).not.toHaveBeenCalled()
  })
})
