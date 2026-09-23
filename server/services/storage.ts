import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { AUDIO_EXTENSIONS, SIGNATURE_LENGTH, detectAudioType } from '../utils/file-type'
import type { AudioExtension, AudioType } from '../utils/file-type'

export const MEDIA_DIRNAME = 'media'

/**
 * Sous `media/` pour que `rename()` reste sur le même système de fichiers,
 * donc atomique. Le point initial le met hors de portée de `/media/:filename`.
 */
const TMP_DIRNAME = '.tmp'

/** Seule forme de nom servie : tout le reste est refusé sans toucher au disque. */
const MEDIA_FILENAME = new RegExp(`^([0-9a-f]{64})\\.(${AUDIO_EXTENSIONS.join('|')})$`)

/** Un fichier stocké, désigné par son contenu : son nom en découle. */
export interface MediaFile {
  checksum: string
  extension: AudioExtension
}

export function mediaFilename(file: MediaFile): string {
  return `${file.checksum}.${file.extension}`
}

export function mediaUrl(file: MediaFile): string {
  return `/${MEDIA_DIRNAME}/${mediaFilename(file)}`
}

export function parseMediaFilename(filename: string): MediaFile | null {
  const match = MEDIA_FILENAME.exec(filename)

  return match ? { checksum: match[1]!, extension: match[2] as AudioExtension } : null
}

/** Un fichier reçu, encore en zone temporaire : ni validé, ni publié. */
export interface ReceivedFile {
  tmpPath: string
  /** SHA-256 hexadécimal du contenu. */
  checksum: string
  sizeBytes: number
  /** Type réel d'après la signature ; `null` si ce n'est pas un format accepté. */
  type: AudioType | null
}

export interface MediaStorage {
  /**
   * Écrit un flux en zone temporaire en calculant son checksum et en lisant
   * sa signature au passage : le fichier n'est lu qu'une fois et jamais
   * gardé en mémoire. Un flux en erreur ne laisse rien derrière lui.
   */
  receive: (source: AsyncIterable<Uint8Array>) => Promise<ReceivedFile>
  /**
   * Publie un fichier reçu sous `media/<xx>/<checksum>.<ext>`. Le nom étant
   * celui du contenu, écraser un fichier existant ne change rien.
   */
  commit: (file: ReceivedFile) => Promise<MediaFile>
  /** Abandonne un fichier reçu. Sans effet s'il a déjà disparu. */
  discard: (file: ReceivedFile) => Promise<void>
  /** Chemin et taille d'un fichier publié, ou `null` s'il n'est pas sur le disque. */
  locate: (file: MediaFile) => Promise<{ path: string, sizeBytes: number } | null>
}

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code

  return code === 'ENOENT' || code === 'ENOTDIR'
}

/**
 * Arborescence à deux niveaux : les deux premiers caractères du checksum
 * forment le sous-dossier, pour qu'aucun répertoire ne compte des milliers
 * d'entrées.
 */
export function createMediaStorage(dataDir: string): MediaStorage {
  const mediaDir = join(dataDir, MEDIA_DIRNAME)
  const tmpDir = join(mediaDir, TMP_DIRNAME)

  const pathOf = (file: MediaFile) => join(mediaDir, file.checksum.slice(0, 2), mediaFilename(file))

  async function receive(source: AsyncIterable<Uint8Array>): Promise<ReceivedFile> {
    await mkdir(tmpDir, { recursive: true })

    const tmpPath = join(tmpDir, randomUUID())
    const handle = await open(tmpPath, 'wx')
    const hash = createHash('sha256')
    let header = Buffer.alloc(0)
    let sizeBytes = 0

    try {
      for await (const chunk of source) {
        hash.update(chunk)

        if (header.length < SIGNATURE_LENGTH) {
          header = Buffer.concat([header, chunk.subarray(0, SIGNATURE_LENGTH - header.length)])
        }

        await handle.write(chunk)
        sizeBytes += chunk.byteLength
      }

      // Sur le disque avant d'être renommé : un arrêt brutal ne doit pas
      // publier un fichier tronqué sous le nom de son contenu complet.
      await handle.sync()
    }
    catch (error) {
      await handle.close()
      await rm(tmpPath, { force: true })
      throw error
    }

    await handle.close()

    return { tmpPath, checksum: hash.digest('hex'), sizeBytes, type: detectAudioType(header) }
  }

  async function commit(file: ReceivedFile): Promise<MediaFile> {
    if (!file.type) {
      // L'appelant refuse le fichier avant d'en arriver là (`415`) : publier
      // un type inconnu serait servir un fichier sous un faux type MIME.
      throw new Error('Un fichier de type non reconnu ne peut pas être publié.')
    }

    const published = { checksum: file.checksum, extension: file.type.extension }
    const target = pathOf(published)

    await mkdir(dirname(target), { recursive: true })
    await rename(file.tmpPath, target)

    return published
  }

  async function discard(file: ReceivedFile): Promise<void> {
    await rm(file.tmpPath, { force: true })
  }

  async function locate(file: MediaFile) {
    const path = pathOf(file)

    try {
      const stats = await stat(path)

      return stats.isFile() ? { path, sizeBytes: stats.size } : null
    }
    catch (error) {
      if (isMissing(error)) {
        return null
      }

      throw error
    }
  }

  return { receive, commit, discard, locate }
}
