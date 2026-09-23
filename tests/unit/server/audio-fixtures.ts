/** Débuts de fichiers réels, réduits à ce qu'en lit la détection de type. */

function bytes(...parts: Array<string | number[]>): Uint8Array {
  return Uint8Array.from(parts.flatMap(part =>
    typeof part === 'string' ? [...part].map(char => char.charCodeAt(0)) : part,
  ))
}

const PADDING = new Array<number>(48).fill(0)

export const HEADERS = {
  mp3Id3: bytes('ID3', [0x04, 0x00, 0x00], PADDING),
  // MPEG-1 couche III, 128 kb/s, 44,1 kHz : l'en-tête de trame le plus courant.
  mp3Frame: bytes([0xFF, 0xFB, 0x90, 0x64], PADDING),
  ogg: bytes('OggS', [0x00, 0x02], PADDING),
  wav: bytes('RIFF', [0x24, 0x08, 0x00, 0x00], 'WAVEfmt ', PADDING),
  m4a: bytes([0x00, 0x00, 0x00, 0x20], 'ftypM4A ', [0x00, 0x00, 0x00, 0x00], 'M4A isom', PADDING),
  webm: bytes([0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84], 'webm', PADDING),
  // Refus : conteneurs voisins, autres fichiers qui se font passer pour de l'audio.
  matroska: bytes([0x1A, 0x45, 0xDF, 0xA3, 0xA3, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x88], 'matroska', PADDING),
  heic: bytes([0x00, 0x00, 0x00, 0x18], 'ftypheic', [0x00, 0x00, 0x00, 0x00], 'mif1heic', PADDING),
  aacAdts: bytes([0xFF, 0xF1, 0x50, 0x80], PADDING),
  zip: bytes('PK', [0x03, 0x04, 0x14, 0x00], PADDING),
  png: bytes([0x89], 'PNG', [0x0D, 0x0A, 0x1A, 0x0A], PADDING),
  text: bytes('<!doctype html><title>pas un son</title>'),
  empty: bytes(),
} as const

/** Un fichier complet : une signature suivie d'un contenu arbitraire. */
export function audioFile(header: Uint8Array, bodyLength = 1000): Uint8Array {
  const file = new Uint8Array(header.length + bodyLength)

  file.set(header)

  for (let index = header.length; index < file.length; index++) {
    file[index] = index % 251
  }

  return file
}
