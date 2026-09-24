import { describe, expect, it } from 'vitest'
import { readBoardQuery, toRouteQuery } from '~/composables/useSoundFilters'

describe('état de la board dans l\'URL', () => {
  it('lit recherche, tags et page', () => {
    expect(readBoardQuery({ q: ' tada ', tags: ['blagues', 'cinema'], page: '2' }))
      .toStrictEqual({ q: 'tada', tags: ['blagues', 'cinema'], page: 2 })
  })

  it('accepte un tag seul, hors tableau', () => {
    expect(readBoardQuery({ tags: 'blagues' }).tags).toEqual(['blagues'])
  })

  it('lit chaque paramètre à part : un tag mal formé n\'efface pas la recherche', () => {
    expect(readBoardQuery({ q: 'tada', tags: ['Pas Un Slug'] })).toStrictEqual({ q: 'tada', tags: [], page: 1 })
  })

  it('ne garde dans l\'URL que ce qui s\'écarte des valeurs par défaut', () => {
    expect(toRouteQuery({ q: undefined, tags: [], page: 1 })).toStrictEqual({})
    expect(toRouteQuery({ q: 'tada', tags: ['blagues'], page: 3 })).toStrictEqual({ q: 'tada', tags: ['blagues'], page: '3' })
  })
})
