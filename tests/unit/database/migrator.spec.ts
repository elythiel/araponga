// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { applyMigrations, parseMigrations } from '../../../server/database/migrator'
import { MIGRATIONS_DIR, loadMigrationsFromDisk } from '../../../server/database/migrations'
import { IN_MEMORY, createDatabase, databaseFile } from '../../../server/database/client'

describe('lecture des migrations', () => {
  it('produit les mêmes migrations que drizzle-orm', () => {
    // Le serveur lit les migrations depuis les assets Nitro et non depuis le
    // disque : ce test garantit que notre lecture reste interchangeable avec
    // celle de drizzle, donc que la table de suivi reste compatible.
    expect(loadMigrationsFromDisk()).toEqual(
      readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR }).map(migration => ({
        hash: migration.hash,
        folderMillis: migration.folderMillis,
        sql: migration.sql,
      })),
    )
  })

  it('découpe un fichier sur les points d\'arrêt', () => {
    const migrations = parseMigrations(
      { entries: [{ tag: '0000_test', when: 42 }] },
      () => 'CREATE TABLE a (id text);--> statement-breakpoint\nCREATE TABLE b (id text);',
    )

    expect(migrations).toHaveLength(1)
    expect(migrations[0]?.sql).toHaveLength(2)
    expect(migrations[0]?.folderMillis).toBe(42)
  })
})

describe('application des migrations', () => {
  it('n\'applique chaque migration qu\'une fois', () => {
    const { sqlite } = createDatabase(IN_MEMORY)
    const migrations = loadMigrationsFromDisk()

    expect(applyMigrations(sqlite, migrations)).toBe(migrations.length)
    expect(applyMigrations(sqlite, migrations)).toBe(0)

    const tracked = sqlite
      .prepare('SELECT hash FROM __drizzle_migrations')
      .all() as { hash: string }[]

    expect(tracked.map(row => row.hash)).toEqual(migrations.map(migration => migration.hash))

    sqlite.close()
  })
})

describe('démarrage sur un volume vide', () => {
  const directories: string[] = []

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('crée le fichier de base et applique les migrations', () => {
    const dataDir = join(mkdtempSync(join(tmpdir(), 'araponga-')), 'data')
    directories.push(dataDir)

    const { sqlite } = createDatabase(databaseFile(dataDir))

    expect(applyMigrations(sqlite, loadMigrationsFromDisk())).toBeGreaterThan(0)
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)

    const tables = sqlite
      .prepare('SELECT name FROM sqlite_master WHERE type = ?')
      .all('table')
      .map(row => (row as { name: string }).name)

    expect(tables).toEqual(expect.arrayContaining(['users', 'sounds', 'tags', 'sound_tags']))

    sqlite.close()
  })
})
