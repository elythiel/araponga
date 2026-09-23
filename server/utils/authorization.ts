import type { User } from '../database/schema'
import { ApiError } from './errors'

const ADMIN_PREFIX = '/api/admin'

/**
 * Le chemin relève-t-il de l'administration ? Volontairement plus large que
 * le routeur : chemin décodé, casse ignorée, barres obliques fusionnées. Un
 * chemin qu'aucune route admin ne sert peut être gardé pour rien ; l'inverse
 * serait une route admin exposée.
 */
export function isAdminPath(path: string): boolean {
  let pathname = path.split('?')[0] ?? ''

  try {
    pathname = decodeURIComponent(pathname)
  }
  catch {
    // Encodage invalide : on garde la forme brute, la comparaison reste possible.
  }

  const normalized = pathname.replace(/[/\\]+/g, '/').toLowerCase()

  return normalized === ADMIN_PREFIX || normalized.startsWith(`${ADMIN_PREFIX}/`)
}

/**
 * Seul contrôle d'accès de l'administration, appliqué par
 * `server/middleware/admin.ts`. Le rôle vient de la base, jamais du cookie.
 */
export function assertAdmin(user: User | null): User {
  if (!user) {
    throw new ApiError('unauthenticated')
  }

  if (user.role !== 'admin') {
    throw new ApiError('forbidden')
  }

  return user
}
