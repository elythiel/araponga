import { applyMigrations, parseMigrations } from '../database/migrator'
import type { Migration, MigrationJournal } from '../database/migrator'
import { createDatabase, databaseFile, setDatabaseConnection } from '../database/client'

/**
 * Les migrations sont embarquées comme assets serveur : le dossier
 * `server/database/migrations` n'existe pas dans `.output`, donc les lire
 * depuis le disque marcherait en développement et casserait en production.
 */
async function loadMigrationsFromAssets(): Promise<Migration[]> {
  const storage = useStorage('assets:migrations')
  const journal = await storage.getItem<MigrationJournal>('meta:_journal.json')

  if (!journal) {
    throw new Error('Journal de migrations introuvable dans les assets serveur.')
  }

  const sources = new Map<string, string>()

  for (const entry of journal.entries) {
    const sql = await storage.getItem<string>(`${entry.tag}.sql`)

    if (typeof sql !== 'string') {
      throw new Error(`Migration ${entry.tag}.sql introuvable dans les assets serveur.`)
    }

    sources.set(entry.tag, sql)
  }

  return parseMigrations(journal, tag => sources.get(tag)!)
}

export default defineNitroPlugin(async (nitro) => {
  // `DATA_DIR` est le nom documenté (.env.example, déploiement) ; il doit être
  // relu au démarrage et pas seulement au build, sinon la même image ne peut
  // pas changer de volume. `NUXT_DATA_DIR` reste possible via runtimeConfig.
  const dataDir = process.env.DATA_DIR ?? useRuntimeConfig().dataDir

  try {
    const connection = createDatabase(databaseFile(dataDir))
    const applied = applyMigrations(connection.sqlite, await loadMigrationsFromAssets())

    if (applied > 0) {
      console.info(`[database] ${applied} migration(s) appliquée(s)`)
    }

    setDatabaseConnection(connection)

    nitro.hooks.hook('close', () => {
      connection.sqlite.close()
    })
  }
  catch (error) {
    // Servir une application dont la base n'est pas migrée est pire que ne
    // pas démarrer : Nitro n'échoue pas de lui-même sur un plugin en erreur.
    console.error('[database] migration impossible, arrêt du serveur', error)
    process.exit(1)
  }
})
