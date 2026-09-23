import { createReadStream } from 'node:fs'
import { getRequestHeader, getRouterParam, sendNoContent, sendStream, setResponseHeaders, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import { parseMediaFilename } from '../services/storage'
import type { MediaStorage } from '../services/storage'
import { ApiError } from './errors'
import { AUDIO_TYPES } from './file-type'
import { parseRange } from './range'

/**
 * Le nom d'un fichier est son checksum : son contenu ne changera jamais, le
 * navigateur et le service worker peuvent le garder indéfiniment.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable'

/** `If-None-Match` compare faiblement : `W/"x"` vaut `"x"`, `*` vaut tout. */
function matchesEtag(header: string | undefined, etag: string): boolean {
  return (header ?? '')
    .split(',')
    .map(tag => tag.trim().replace(/^W\//, ''))
    .some(tag => tag === '*' || tag === etag)
}

/**
 * `GET /media/:filename`. Le nom est contrôlé avant tout accès au disque :
 * seul `<checksum>.<ext>` peut atteindre le stockage, aucune traversée de
 * chemin n'est donc possible.
 *
 * Le type MIME se déduit de l'extension, sans lecture en base : celle-ci a
 * été fixée d'après la signature du fichier au moment de l'upload.
 */
export async function serveMedia(event: H3Event, storage: Pick<MediaStorage, 'locate'>) {
  const file = parseMediaFilename(getRouterParam(event, 'filename') ?? '')

  if (!file) {
    throw new ApiError('not_found')
  }

  const stored = await storage.locate(file)

  if (!stored) {
    throw new ApiError('not_found')
  }

  const etag = `"${file.checksum}"`
  const size = stored.sizeBytes

  setResponseHeaders(event, {
    'accept-ranges': 'bytes',
    'cache-control': IMMUTABLE,
    'content-type': AUDIO_TYPES[file.extension],
    'etag': etag,
  })

  if (matchesEtag(getRequestHeader(event, 'if-none-match'), etag)) {
    return sendNoContent(event, 304)
  }

  // `If-Range` périmé : le client ne doit pas recoller un fragment d'une autre
  // version. Un nom de contenu n'en a qu'une, mais la règle ne coûte rien.
  const ifRange = getRequestHeader(event, 'if-range')
  const range = ifRange === undefined || ifRange === etag
    ? parseRange(getRequestHeader(event, 'range'), size)
    : null

  if (range === 'unsatisfiable') {
    setResponseHeaders(event, { 'content-range': `bytes */${size}` })

    return sendNoContent(event, 416)
  }

  if (range) {
    setResponseStatus(event, 206)
    setResponseHeaders(event, {
      'content-range': `bytes ${range.start}-${range.end}/${size}`,
      'content-length': range.end - range.start + 1,
    })

    return sendStream(event, createReadStream(stored.path, range))
  }

  setResponseHeaders(event, { 'content-length': size })

  return sendStream(event, createReadStream(stored.path))
}
