import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>

export interface DatabaseConnection {
  /** Handle brut, nécessaire aux PRAGMA et aux migrations. */
  sqlite: BetterSqlite3.Database
  db: Database
}

export const IN_MEMORY = ':memory:'

export const DATABASE_FILENAME = 'araponga.db'

/** Un seul volume : la base et les médias vivent côte à côte sous `DATA_DIR`. */
export function databaseFile(dataDir: string): string {
  return join(dataDir, DATABASE_FILENAME)
}

/**
 * Ouvre une connexion et pose les deux PRAGMA qui ne sont pas des réglages
 * de confort : WAL pour que les lectures ne bloquent pas l'écriture, et
 * `foreign_keys` que SQLite laisse désactivé par défaut — sans lui, les
 * `ON DELETE CASCADE` du schéma ne seraient jamais appliqués.
 */
export function createDatabase(filename: string): DatabaseConnection {
  if (filename !== IN_MEMORY) {
    mkdirSync(dirname(filename), { recursive: true })
  }

  const sqlite = new BetterSqlite3(filename)

  // WAL n'a pas de sens sur une base en mémoire et y est ignoré par SQLite.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  return { sqlite, db: drizzle(sqlite, { schema }) }
}

let connection: DatabaseConnection | undefined

/**
 * Connexion unique au processus. Ouverte une fois par le plugin Nitro, avant
 * que le serveur n'accepte la moindre requête.
 */
export function setDatabaseConnection(next: DatabaseConnection): void {
  connection = next
}

export function useDatabase(): Database {
  if (!connection) {
    throw new Error('La base de données n\'est pas ouverte.')
  }

  return connection.db
}

export function closeDatabase(): void {
  connection?.sqlite.close()
  connection = undefined
}
