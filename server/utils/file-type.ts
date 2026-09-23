/**
 * Formats audio acceptés, et le type MIME sous lequel chacun est servi.
 * L'extension d'un fichier stocké découle toujours de sa signature : c'est ce
 * qui rend cette table fidèle, et le type MIME déductible du nom seul.
 */
export const AUDIO_TYPES = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
} as const

export type AudioExtension = keyof typeof AUDIO_TYPES

export const AUDIO_EXTENSIONS = Object.keys(AUDIO_TYPES) as AudioExtension[]

export interface AudioType {
  extension: AudioExtension
  mimeType: (typeof AUDIO_TYPES)[AudioExtension]
}

/** Octets à lire en tête de fichier pour que toutes les signatures soient décidables. */
export const SIGNATURE_LENGTH = 64

/**
 * Marques ISO BMFF d'un fichier audio. `ftyp` seul ne suffit pas : HEIC et
 * AVIF, des images, partagent le même conteneur.
 */
const MP4_AUDIO_BRANDS = new Set(['M4A ', 'M4B ', 'mp41', 'mp42', 'isom', 'iso2', 'dash'])

const EBML_MAGIC = [0x1A, 0x45, 0xDF, 0xA3]
const EBML_DOCTYPE_ID = [0x42, 0x82]

function ascii(header: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...header.subarray(start, end))
}

function startsWith(header: Uint8Array, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, index) => header[offset + index] === byte)
}

/**
 * Trame MPEG audio couche I à III, sans ID3 en tête : 11 bits de
 * synchronisation, puis une version et une couche qui ne sont pas les valeurs
 * réservées. La couche `00` exclut l'AAC brut (ADTS), qui partage la synchro.
 */
function isMpegFrame(header: Uint8Array): boolean {
  const [first = 0, second = 0, third = 0] = header

  const sync = first === 0xFF && (second & 0xE0) === 0xE0
  const version = (second >> 3) & 0b11
  const layer = (second >> 1) & 0b11
  const bitrate = third >> 4

  return sync && version !== 0b01 && layer !== 0b00 && bitrate !== 0b1111
}

/**
 * Le DocType d'un en-tête EBML distingue WebM de Matroska. Il est l'un des
 * tout premiers éléments : on le cherche dans les octets disponibles.
 */
function ebmlDocType(header: Uint8Array): string | null {
  for (let index = EBML_MAGIC.length; index + EBML_DOCTYPE_ID.length < header.length; index++) {
    if (!startsWith(header, EBML_DOCTYPE_ID, index)) {
      continue
    }

    // Taille sur un octet (bit de tête à 1) : c'est toujours le cas d'un
    // DocType, qui ne fait que quelques caractères.
    const sizeByte = header[index + 2] ?? 0

    if ((sizeByte & 0x80) === 0) {
      return null
    }

    const start = index + 3

    return ascii(header, start, start + (sizeByte & 0x7F))
  }

  return null
}

function detectExtension(header: Uint8Array): AudioExtension | null {
  if (ascii(header, 0, 3) === 'ID3' || isMpegFrame(header)) {
    return 'mp3'
  }

  if (ascii(header, 0, 4) === 'OggS') {
    return 'ogg'
  }

  if (ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WAVE') {
    return 'wav'
  }

  if (ascii(header, 4, 8) === 'ftyp' && MP4_AUDIO_BRANDS.has(ascii(header, 8, 12))) {
    return 'm4a'
  }

  if (startsWith(header, EBML_MAGIC) && ebmlDocType(header) === 'webm') {
    return 'webm'
  }

  return null
}

/**
 * Type réel d'un fichier d'après ses premiers octets (au moins
 * `SIGNATURE_LENGTH` quand le fichier les a). Le nom et le `Content-Type`
 * annoncés par le client ne font jamais foi : un `.mp3` qui est un ZIP
 * donne `null`.
 */
export function detectAudioType(header: Uint8Array): AudioType | null {
  const extension = detectExtension(header)

  return extension && { extension, mimeType: AUDIO_TYPES[extension] }
}
