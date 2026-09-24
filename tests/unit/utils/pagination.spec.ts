import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, pageCountOf, pageSlice, pageWindow, parsePage } from '~/utils/pagination'

describe('pagination de la board', () => {
  it('affiche 48 sons par page', () => {
    const items = Array.from({ length: 100 }, (_, index) => index)

    expect(PAGE_SIZE).toBe(48)
    expect(pageSlice(items, 1)).toHaveLength(48)
    expect(pageSlice(items, 3)).toEqual([96, 97, 98, 99])
    expect(pageCountOf(100)).toBe(3)
  })

  it('compte au moins une page, même vide', () => {
    expect(pageCountOf(0)).toBe(1)
    expect(pageCountOf(48)).toBe(1)
    expect(pageCountOf(49)).toBe(2)
  })

  it.each([
    ['2', 2],
    [['3', '4'], 3],
    [undefined, 1],
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['abc', 1],
  ])('lit la page %j comme %i', (value, page) => {
    expect(parsePage(value)).toBe(page)
  })

  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [1, 11, [1, 2, 'gap', 11]],
    [5, 11, [1, 'gap', 4, 5, 6, 'gap', 11]],
    [3, 11, [1, 2, 3, 4, 'gap', 11]],
    [11, 11, [1, 'gap', 10, 11]],
  ])('page %i sur %i : %j', (page, pageCount, expected) => {
    expect(pageWindow(page, pageCount)).toEqual(expected)
  })
})
