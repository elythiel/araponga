// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { soundTags, sounds, tags } from '../../../server/database/schema'
import type { DatabaseConnection } from '../../../server/database/client'
import { getCatalog } from '../../../server/services/catalog'
import { filterSounds } from '../../../shared/catalog'
import type { CatalogSound } from '../../../shared/catalog'
import { aSound, aTag, createTestDatabase } from '../database/helpers'

const ALL = { tags: [] }

describe('getCatalog', () => {
  let connection: DatabaseConnection

  const blagues = aTag({ name: 'Blagues', slug: 'blagues' })
  const cinema = aTag({ name: 'Cinéma', slug: 'cinema' })
  const orphelin = aTag({ name: 'Ambiances', slug: 'ambiances' })

  const rimshot = aSound({
    name: 'Rimshot',
    description: 'Ba dum tss',
    checksum: 'a'.repeat(64),
    hotkey: 'r',
    position: 2000,
  })
  const verre = aSound({
    name: 'Verre brisé',
    checksum: 'b'.repeat(64),
    extension: 'ogg',
    mimeType: 'audio/ogg',
    durationMs: null,
    position: 1000,
  })
  const klaxon = aSound({ name: 'Klaxon', checksum: 'c'.repeat(64), position: 3000 })

  beforeEach(() => {
    connection = createTestDatabase()

    connection.db.insert(tags).values([blagues, cinema, orphelin]).run()
    connection.db.insert(sounds).values([rimshot, verre, klaxon]).run()
    connection.db.insert(soundTags).values([
      { soundId: rimshot.id, tagId: blagues.id },
      { soundId: rimshot.id, tagId: cinema.id },
      { soundId: verre.id, tagId: cinema.id },
    ]).run()
  })

  afterEach(() => {
    connection.sqlite.close()
  })

  it('suit la forme de docs/03-api.md', async () => {
    const catalog = await getCatalog(connection.db, ALL)

    expect(catalog.sounds.find(sound => sound.id === rimshot.id)).toStrictEqual({
      id: rimshot.id,
      name: 'Rimshot',
      description: 'Ba dum tss',
      url: `/media/${'a'.repeat(64)}.mp3`,
      mimeType: 'audio/mpeg',
      durationMs: 1500,
      hotkey: 'r',
      position: 2000,
      tags: [
        { id: blagues.id, name: 'Blagues', slug: 'blagues' },
        { id: cinema.id, name: 'Cinéma', slug: 'cinema' },
      ],
    })
  })

  it('ordonne les sons par position', async () => {
    const catalog = await getCatalog(connection.db, ALL)

    expect(catalog.sounds.map(sound => sound.name)).toEqual(['Verre brisé', 'Rimshot', 'Klaxon'])
  })

  it('liste tous les tags par slug, orphelins compris, avec leur nombre de sons', async () => {
    const catalog = await getCatalog(connection.db, ALL)

    expect(catalog.tags).toStrictEqual([
      { id: orphelin.id, name: 'Ambiances', slug: 'ambiances', soundCount: 0 },
      { id: blagues.id, name: 'Blagues', slug: 'blagues', soundCount: 1 },
      { id: cinema.id, name: 'Cinéma', slug: 'cinema', soundCount: 2 },
    ])
  })

  it('filtre les sons sans toucher à la liste des tags', async () => {
    const catalog = await getCatalog(connection.db, { q: 'klax', tags: [] })

    expect(catalog.sounds.map(sound => sound.name)).toEqual(['Klaxon'])
    expect(catalog.tags).toHaveLength(3)
  })

  it('renvoie un catalogue vide sur une base vide', async () => {
    connection.db.delete(sounds).run()
    connection.db.delete(tags).run()

    expect(await getCatalog(connection.db, ALL)).toStrictEqual({ sounds: [], tags: [] })
  })
})

describe('filterSounds', () => {
  const sound = (name: string, description: string | null, slugs: string[]): CatalogSound => ({
    id: name,
    name,
    description,
    url: '',
    mimeType: 'audio/mpeg',
    durationMs: null,
    hotkey: null,
    position: 0,
    tags: slugs.map(slug => ({ id: slug, name: slug, slug })),
  })

  const catalog = [
    sound('Verre brisé', null, ['cinema']),
    sound('Rimshot', 'Après une blague', ['blagues', 'cinema']),
    sound('Klaxon', null, []),
  ]

  const names = (query: Parameters<typeof filterSounds>[1]) => filterSounds(catalog, query).map(s => s.name)

  it('sans filtre, rend tout dans l\'ordre reçu', () => {
    expect(names({ tags: [] })).toEqual(['Verre brisé', 'Rimshot', 'Klaxon'])
  })

  it('cherche sans tenir compte de la casse ni des accents', () => {
    expect(names({ q: 'BRISE', tags: [] })).toEqual(['Verre brisé'])
    expect(names({ q: 'brisé', tags: [] })).toEqual(['Verre brisé'])
  })

  it('cherche aussi dans la description', () => {
    expect(names({ q: 'apres', tags: [] })).toEqual(['Rimshot'])
  })

  it('filtre les tags en intersection', () => {
    expect(names({ tags: ['cinema'] })).toEqual(['Verre brisé', 'Rimshot'])
    expect(names({ tags: ['cinema', 'blagues'] })).toEqual(['Rimshot'])
    expect(names({ tags: ['inconnu'] })).toEqual([])
  })

  it('combine recherche et tags', () => {
    expect(names({ q: 'verre', tags: ['blagues'] })).toEqual([])
  })
})
