/** Bornes incluses d'un fragment, comme les écrit `Content-Range`. */
export interface ByteRange {
  start: number
  end: number
}

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/

/**
 * Interprète un en-tête `Range` pour une ressource de `size` octets
 * (RFC 9110 § 14). Renvoie `null` quand la ressource doit être servie
 * entière : pas d'en-tête, unité inconnue, forme invalide ou plusieurs
 * fragments — la RFC autorise à ignorer ce qu'on ne sait pas servir, et un
 * lecteur audio ne demande jamais qu'un fragment à la fois.
 */
export function parseRange(header: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  const match = SINGLE_RANGE.exec(header?.trim() ?? '')

  if (!match) {
    return null
  }

  const [, first = '', last = ''] = match

  if (first === '') {
    if (last === '') {
      return null
    }

    // `bytes=-N` : les N derniers octets.
    const suffix = Number(last)

    return suffix === 0 || size === 0 ? 'unsatisfiable' : { start: Math.max(0, size - suffix), end: size - 1 }
  }

  const start = Number(first)

  if (last !== '' && Number(last) < start) {
    return null
  }

  if (start >= size) {
    return 'unsatisfiable'
  }

  // Une fin au-delà de la ressource est ramenée à son dernier octet.
  return { start, end: last === '' ? size - 1 : Math.min(Number(last), size - 1) }
}
