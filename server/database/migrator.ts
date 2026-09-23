import { createHash } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'

const MIGRATIONS_TABLE = '__drizzle_migrations'
const STATEMENT_BREAKPOINT = '--> statement-breakpoint'

export interface MigrationJournalEntry {
  tag: string
  when: number
}

export interface MigrationJournal {
  entries: MigrationJournalEntry[]
}

export interface Migration {
  hash: string
  folderMillis: number
  sql: string[]
}

/**
 * Transforme un journal `drizzle-kit` et le contenu des fichiers `.sql` en
 * migrations applicables. Pure : le fichier qui sait *où* lire les migrations
 * (disque en test, assets Nitro au démarrage) n'a plus qu'à fournir `readSql`.
 *
 * Le découpage et le hachage reproduisent `readMigrationFiles` de
 * `drizzle-orm/migrator`, pour que la table de suivi reste compatible avec
 * `drizzle-kit migrate`.
 */
export function parseMigrations(
  journal: MigrationJournal,
  readSql: (tag: string) => string,
): Migration[] {
  return journal.entries.map((entry) => {
    const query = readSql(entry.tag)

    return {
      hash: createHash('sha256').update(query).digest('hex'),
      folderMillis: entry.when,
      sql: query.split(STATEMENT_BREAKPOINT),
    }
  })
}

/**
 * Applique les migrations manquantes dans une transaction unique et renvoie
 * le nombre de migrations jouées. Idempotent : un second appel ne fait rien.
 */
export function applyMigrations(sqlite: BetterSqlite3.Database, migrations: Migration[]): number {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `)

  const last = sqlite
    .prepare(`SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`)
    .get() as { created_at: number | null } | undefined

  const appliedUpTo = Number(last?.created_at ?? Number.NEGATIVE_INFINITY)
  const pending = migrations.filter(migration => migration.folderMillis > appliedUpTo)

  if (pending.length === 0) {
    return 0
  }

  const record = sqlite.prepare(
    `INSERT INTO ${MIGRATIONS_TABLE} ("hash", "created_at") VALUES (?, ?)`,
  )

  sqlite.transaction(() => {
    for (const migration of pending) {
      for (const statement of migration.sql) {
        const trimmed = statement.trim()

        if (trimmed.length > 0) {
          sqlite.exec(trimmed)
        }
      }

      record.run(migration.hash, migration.folderMillis)
    }
  })()

  return pending.length
}
