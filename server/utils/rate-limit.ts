export interface RateLimiter {
  /**
   * Compte une tentative pour `key`. Renvoie `null` si elle est permise,
   * sinon le délai en millisecondes avant la prochaine tentative possible.
   */
  hit: (key: string) => number | null
}

export interface RateLimiterOptions {
  limit: number
  windowMs: number
  now?: () => number
}

/**
 * Fenêtre glissante en mémoire. Un seul processus sert l'application : pas
 * besoin de stockage partagé, et un redémarrage remet les compteurs à zéro.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>()

  function hit(key: string): number | null {
    const current = now()
    const recent = (hits.get(key) ?? []).filter(time => time > current - windowMs)

    if (recent.length >= limit) {
      hits.set(key, recent)

      return recent[0]! + windowMs - current
    }

    recent.push(current)
    hits.set(key, recent)

    // Les clés inactives sont purgées au passage, sans minuterie.
    for (const [other, times] of hits) {
      if (times.every(time => time <= current - windowMs)) {
        hits.delete(other)
      }
    }

    return null
  }

  return { hit }
}
