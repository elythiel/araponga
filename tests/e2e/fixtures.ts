/**
 * WAV PCM 16 bits mono, un quart de seconde. `seed` change le contenu, donc
 * le checksum : chaque appel distinct donne un son distinct.
 */
export function wavFile(seed: number): Buffer {
  const sampleRate = 8000
  const samples = sampleRate / 4
  const data = Buffer.alloc(samples * 2)

  for (let index = 0; index < samples; index++) {
    data.writeInt16LE(Math.round(Math.sin((index * (seed + 1)) / 10) * 8000), index * 2)
  }

  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)

  return Buffer.concat([header, data])
}

/** Une archive ZIP vide, déguisée en MP3 par son nom. */
export const ZIP_FILE = Buffer.from([0x50, 0x4B, 0x05, 0x06, ...new Array<number>(18).fill(0)])
