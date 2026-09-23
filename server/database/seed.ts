import { v7 as uuidv7 } from 'uuid'
// Chemin relatif : le seed tourne sous jiti, hors de Nuxt et de ses alias.
import { slugify } from '../../shared/schemas/tag'
import { applyMigrations } from './migrator'
import { loadMigrationsFromDisk } from './migrations'
import { createDatabase, databaseFile } from './client'
import { soundTags, sounds, tags, users } from './schema'

/**
 * Jeu de données de développement. Les sons pointent vers des checksums qui
 * n'ont aucun fichier sur le disque : le catalogue s'affiche, la lecture
 * échouera tant que le stockage des fichiers n'existe pas.
 */
function seed(dataDir: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed est réservé au développement.')
  }

  const { sqlite, db } = createDatabase(databaseFile(dataDir))

  applyMigrations(sqlite, loadMigrationsFromDisk())

  // Table de jonction d'abord : les cascades feraient le travail, mais
  // l'ordre explicite évite de dépendre d'un PRAGMA pour un utilitaire.
  db.delete(soundTags).run()
  db.delete(sounds).run()
  db.delete(tags).run()
  db.delete(users).run()

  const now = Date.now()

  const admin = {
    id: uuidv7(),
    issuer: 'https://mock-oidc.localhost',
    subject: 'seed-admin',
    email: 'admin@example.com',
    name: 'Administratrice de démonstration',
    role: 'admin' as const,
    createdAt: now,
    lastLoginAt: now,
  }

  db.insert(users).values(admin).run()

  const tagRows = ['Blagues', 'Ambiances', 'Jeux vidéo', 'Cinéma'].map((name, index) => ({
    id: uuidv7(),
    name,
    slug: slugify(name),
    createdAt: now + index,
  }))

  db.insert(tags).values(tagRows).run()

  const soundRows = [
    { name: 'Rimshot', hotkey: 'a', extension: 'mp3', mimeType: 'audio/mpeg' },
    { name: 'Applaudissements', hotkey: 'b', extension: 'ogg', mimeType: 'audio/ogg' },
    { name: 'Grillons', hotkey: 'c', extension: 'mp3', mimeType: 'audio/mpeg' },
    { name: 'Klaxon', hotkey: null, extension: 'wav', mimeType: 'audio/wav' },
    { name: 'Fanfare', hotkey: 'f1', extension: 'm4a', mimeType: 'audio/mp4' },
    { name: 'Verre brisé', hotkey: null, extension: 'webm', mimeType: 'audio/webm' },
  ].map((sound, index) => ({
    id: uuidv7(),
    name: sound.name,
    description: null,
    // Checksum factice mais de la bonne forme : 64 caractères hexadécimaux.
    checksum: `${index}`.repeat(2).padEnd(64, `${index}0abcdef`),
    extension: sound.extension,
    mimeType: sound.mimeType,
    sizeBytes: 120_000 + index * 1000,
    durationMs: 1500 + index * 250,
    originalFilename: `${sound.name.toLowerCase().replace(/\s+/g, '-')}.${sound.extension}`,
    hotkey: sound.hotkey,
    position: (index + 1) * 1000,
    createdBy: admin.id,
    createdAt: now + index,
    updatedAt: now + index,
  }))

  db.insert(sounds).values(soundRows).run()

  // Deux tags sur les trois premiers sons, un seul sur les suivants.
  const links = soundRows.flatMap((sound, index) => {
    const first = tagRows[index % tagRows.length]!
    const second = tagRows[(index + 1) % tagRows.length]!

    return index < 3
      ? [{ soundId: sound.id, tagId: first.id }, { soundId: sound.id, tagId: second.id }]
      : [{ soundId: sound.id, tagId: first.id }]
  })

  db.insert(soundTags).values(links).run()

  sqlite.close()

  console.info(
    `[seed] ${1} utilisateur, ${tagRows.length} tags, ${soundRows.length} sons, `
    + `${links.length} associations dans ${databaseFile(dataDir)}`,
  )
}

seed(process.env.DATA_DIR ?? './data')
