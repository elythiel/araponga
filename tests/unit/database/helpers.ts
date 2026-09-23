import { applyMigrations } from '../../../server/database/migrator'
import { loadMigrationsFromDisk } from '../../../server/database/migrations'
import { IN_MEMORY, createDatabase } from '../../../server/database/client'
import type { DatabaseConnection } from '../../../server/database/client'

/** Base en mémoire, migrée : exactement le schéma que le serveur ouvrira. */
export function createTestDatabase(): DatabaseConnection {
  const connection = createDatabase(IN_MEMORY)

  applyMigrations(connection.sqlite, loadMigrationsFromDisk())

  return connection
}

/**
 * Renvoie le code d'erreur SQLite d'une opération censée échouer. Cibler le
 * code plutôt que le message rend le test indépendant du texte de SQLite.
 */
export function constraintCodeOf(action: () => void): string {
  try {
    action()
  }
  catch (error) {
    return (error as { code?: string }).code ?? 'erreur sans code'
  }

  throw new Error('L\'opération aurait dû échouer, elle a réussi.')
}

export function aUser(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    issuer: 'https://auth.example.com',
    subject: 'subject-1',
    email: null,
    name: null,
    role: 'user' as const,
    createdAt: 1_700_000_000_000,
    lastLoginAt: null,
    ...overrides,
  }
}

export function aSound(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Rimshot',
    description: null,
    checksum: 'a'.repeat(64),
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 120_000,
    durationMs: 1500,
    originalFilename: 'rimshot.mp3',
    hotkey: null,
    position: 1000,
    createdBy: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

export function aTag(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Blagues',
    slug: 'blagues',
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}
