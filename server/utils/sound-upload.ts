import type { IncomingMessage } from 'node:http'
import type { Readable } from 'node:stream'
import busboy from 'busboy'
import type { MediaStorage, ReceivedFile } from '../services/storage'
import { ApiError } from './errors'

/** Champ du formulaire qui porte le fichier, tel que le décrit docs/03-api.md. */
export const FILE_FIELD = 'file'

/**
 * Marge accordée à l'enveloppe multipart (délimiteurs, en-têtes de parties,
 * champs texte) quand on juge une requête à son seul `Content-Length`.
 */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024

export interface SoundUpload {
  /** Champs texte, bruts : leur validation appartient au service. */
  fields: Record<string, string>
  /** Fichier reçu en zone temporaire, ou `null` si la requête n'en portait pas. */
  file: ReceivedFile | null
  /** Nom annoncé par le client : conservé en base, jamais utilisé sur le disque. */
  originalFilename: string | null
}

/**
 * Coupe le flux dès que la limite est franchie : les octets suivants ne sont
 * ni lus, ni écrits.
 */
async function* capped(stream: Readable, maxBytes: number): AsyncGenerator<Uint8Array> {
  let total = 0

  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength

    if (total > maxBytes) {
      throw new ApiError('file_too_large')
    }

    yield chunk
  }
}

/**
 * Lit un upload multipart en streaming : le fichier va directement en zone
 * temporaire, sans jamais être tenu en mémoire, les champs texte sont
 * collectés au passage. Quelle que soit l'issue — fichier trop gros, requête
 * interrompue, corps illisible — aucun fichier temporaire ne subsiste.
 */
export function readSoundUpload(
  req: IncomingMessage,
  storage: Pick<MediaStorage, 'receive' | 'discard'>,
  maxBytes: number,
): Promise<SoundUpload> {
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy

    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: 1, fields: 10, fieldSize: 16 * 1024, parts: 11 },
      })
    }
    catch (error) {
      // Pas de `multipart/form-data`, ou pas de délimiteur.
      reject(new ApiError('bad_request', { cause: error }))

      return
    }

    const fields: Record<string, string> = {}
    let originalFilename: string | null = null
    let fileStream: Readable | undefined
    let receiving: Promise<ReceivedFile> | undefined
    let failure: unknown
    let settled = false

    async function settle() {
      if (settled) {
        return
      }

      settled = true

      // Attendre la fin de la réception, réussie ou non : c'est elle qui
      // supprime son fichier temporaire en cas d'erreur.
      const file = receiving
        ? await receiving.catch((error: unknown) => {
            failure ??= error

            return null
          })
        : null

      if (failure) {
        if (file) {
          await storage.discard(file)
        }

        reject(failure)

        return
      }

      resolve({ fields, file, originalFilename })
    }

    function fail(error: unknown) {
      failure ??= error
      req.unpipe(parser)
      fileStream?.destroy(error instanceof Error ? error : new Error(String(error)))
      void settle()
    }

    parser.on('field', (name, value, info) => {
      if (info.valueTruncated) {
        fail(new ApiError('bad_request'))

        return
      }

      fields[name] = value
    })

    parser.on('file', (name, stream, info) => {
      // Un seul fichier compte ; toute autre partie fichier est ignorée.
      if (name !== FILE_FIELD || receiving) {
        stream.resume()

        return
      }

      fileStream = stream
      originalFilename = info.filename || null
      receiving = storage.receive(capped(stream, maxBytes))
      receiving.catch(fail)
    })

    parser.on('partsLimit', () => fail(new ApiError('bad_request')))
    parser.on('fieldsLimit', () => fail(new ApiError('bad_request')))
    parser.on('error', error => fail(new ApiError('bad_request', { cause: error })))
    parser.on('close', () => void settle())

    // Client parti en cours de route : la réception en cours doit échouer,
    // sinon elle attendrait indéfiniment la suite du fichier.
    req.on('close', () => {
      if (!req.complete) {
        fail(new ApiError('bad_request', { cause: new Error('Upload interrompu par le client.') }))
      }
    })

    req.pipe(parser)
  })
}
