import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

/**
 * Les identifiants sont des UUID v7 stockés en texte : triables
 * chronologiquement, opaques en URL, générables hors base.
 * Les dates sont des epoch ms, jamais des chaînes.
 */

export const USER_ROLES = ['admin', 'user'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    email: text('email'),
    name: text('name'),
    role: text('role').$type<UserRole>().notNull().default('user'),
    createdAt: integer('created_at').notNull(),
    lastLoginAt: integer('last_login_at'),
  },
  table => [
    // Seule identité stable : un email peut changer ou être réattribué
    // par le provider, le couple (iss, sub) non.
    unique('users_issuer_subject_unique').on(table.issuer, table.subject),
  ],
)

export const sounds = sqliteTable(
  'sounds',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    // Unique : le fichier sur disque est nommé d'après le checksum, donc
    // l'unicité vaut aussi garantie de non-écrasement.
    checksum: text('checksum').notNull().unique(),
    extension: text('extension').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    durationMs: integer('duration_ms'),
    originalFilename: text('original_filename').notNull(),
    // Unique quand non nul : SQLite autorise plusieurs NULL sur un index
    // unique, ce qui est exactement la règle voulue.
    hotkey: text('hotkey').unique(),
    position: integer('position').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  table => [index('sounds_position_idx').on(table.position)],
)

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // C'est le slug qui porte l'unicité : « Blagues » et « blagues » sont
  // le même tag.
  slug: text('slug').notNull().unique(),
  createdAt: integer('created_at').notNull(),
})

export const soundTags = sqliteTable(
  'sound_tags',
  {
    soundId: text('sound_id')
      .notNull()
      .references(() => sounds.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  table => [
    primaryKey({ columns: [table.soundId, table.tagId] }),
    index('sound_tags_tag_id_idx').on(table.tagId),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  sounds: many(sounds),
}))

export const soundsRelations = relations(sounds, ({ one, many }) => ({
  createdBy: one(users, { fields: [sounds.createdBy], references: [users.id] }),
  soundTags: many(soundTags),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  soundTags: many(soundTags),
}))

export const soundTagsRelations = relations(soundTags, ({ one }) => ({
  sound: one(sounds, { fields: [soundTags.soundId], references: [sounds.id] }),
  tag: one(tags, { fields: [soundTags.tagId], references: [tags.id] }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Sound = typeof sounds.$inferSelect
export type NewSound = typeof sounds.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type SoundTag = typeof soundTags.$inferSelect
