// @vitest-environment node
import { createHash } from 'node:crypto'
import { createServer, request } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMediaStorage } from '../../../server/services/storage'
import type { MediaStorage } from '../../../server/services/storage'
import { readSoundUpload } from '../../../server/utils/sound-upload'
import type { SoundUpload } from '../../../server/utils/sound-upload'
import { HEADERS, audioFile } from './audio-fixtures'

const MAX_BYTES = 64 * 1024

/**
 * Vrai serveur HTTP : c'est le comportement du flux réseau qui est testé —
 * coupure en cours de route, client qui s'en va.
 */
describe('readSoundUpload', () => {
  let dataDir: string
  let server: Server
  let baseUrl: string
  let outcome: Promise<SoundUpload>
  /** Octets effectivement transmis au stockage, tous fichiers confondus. */
  let bytesStored: number

  const tmpEntries = () => readdir(join(dataDir, 'media', '.tmp')).catch(() => [])

  beforeAll(async () => {
    server = createServer((req, res) => {
      const real = createMediaStorage(dataDir)
      const storage: Pick<MediaStorage, 'receive' | 'discard'> = {
        discard: file => real.discard(file),
        receive: source => real.receive((async function* () {
          for await (const chunk of source) {
            bytesStored += chunk.byteLength
            yield chunk
          }
        })()),
      }

      outcome = readSoundUpload(req, storage, MAX_BYTES)
      outcome.then(
        () => res.end('ok'),
        (error: { statusCode?: number }) => {
          // Comme la route : le reste du corps n'est pas lu, on ferme.
          res.statusCode = error.statusCode ?? 500
          res.setHeader('connection', 'close')
          res.end()
        },
      )
    })

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'araponga-upload-'))
    bytesStored = 0
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  function form(file: Uint8Array | null, fields: Record<string, string> = {}) {
    const body = new FormData()

    for (const [name, value] of Object.entries(fields)) {
      body.append(name, value)
    }

    if (file) {
      body.append('file', new Blob([file as BlobPart]), 'tada.mp3')
    }

    return fetch(baseUrl, { method: 'POST', body })
  }

  it('reçoit les champs et le fichier, sans rien garder en mémoire', async () => {
    const content = audioFile(HEADERS.mp3Id3, 5000)

    await form(content, { name: 'Tada', tags: '["Blagues"]' })

    const { fields, file, originalFilename } = await outcome

    expect(fields).toStrictEqual({ name: 'Tada', tags: '["Blagues"]' })
    expect(originalFilename).toBe('tada.mp3')
    expect(file).toMatchObject({
      checksum: createHash('sha256').update(content).digest('hex'),
      sizeBytes: content.length,
      type: { extension: 'mp3' },
    })
  })

  it('renvoie un fichier nul quand la requête n\'en porte pas', async () => {
    await form(null, { name: 'Tada' })

    expect((await outcome).file).toBeNull()
  })

  it('coupe un fichier trop gros à la limite, sans fichier temporaire', async () => {
    const response = await form(audioFile(HEADERS.mp3Id3, 4 * MAX_BYTES))

    expect(response.status).toBe(413)
    await expect(outcome).rejects.toMatchObject({ code: 'file_too_large' })
    // Le stockage n'a jamais vu plus que la limite, plus un morceau au plus.
    expect(bytesStored).toBeLessThanOrEqual(MAX_BYTES)
    expect(await tmpEntries()).toEqual([])
  })

  it('ne laisse aucun fichier temporaire quand le client s\'interrompt', async () => {
    const boundary = 'limite'
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="tada.mp3"\r\n`
      + 'Content-Type: audio/mpeg\r\n\r\n'

    const client = request(baseUrl, {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': 100_000 },
    })

    client.on('error', () => {})
    client.write(head)
    client.write(audioFile(HEADERS.mp3Id3, 2000))

    // Le serveur a commencé à écrire le fichier avant que le client disparaisse.
    await expect.poll(() => bytesStored).toBeGreaterThan(0)
    client.destroy()

    await expect(outcome).rejects.toMatchObject({ code: 'bad_request' })
    expect(await tmpEntries()).toEqual([])
  })

  it('refuse un corps qui n\'est pas multipart', async () => {
    await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })

    await expect(outcome).rejects.toMatchObject({ code: 'bad_request' })
  })
})
