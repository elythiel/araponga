import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMigrations } from './migrator'
import type { Migration, MigrationJournal } from './migrator'

export const MIGRATIONS_DIR = 'server/database/migrations'

/**
 * Lecture des migrations depuis le disque. Utilisée par le seed et par les
 * tests ; le serveur, lui, les lit depuis les assets Nitro (voir
 * `server/plugins/database.ts`), parce que le dossier n'existe pas dans le
 * bundle de production.
 */
export function loadMigrationsFromDisk(folder: string = MIGRATIONS_DIR): Migration[] {
  const journal = JSON.parse(
    readFileSync(join(folder, 'meta', '_journal.json'), 'utf8'),
  ) as MigrationJournal

  return parseMigrations(journal, tag => readFileSync(join(folder, `${tag}.sql`), 'utf8'))
}
