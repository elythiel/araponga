// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { negotiateLocale } from '../../../server/utils/locale'

describe('negotiateLocale', () => {
  it.each([
    [undefined, 'fr'],
    ['', 'fr'],
    ['en', 'en'],
    ['EN-us', 'en'],
    ['fr-FR,fr;q=0.9,en;q=0.8', 'fr'],
    ['de-DE,de;q=0.9,en;q=0.5', 'en'],
    ['en;q=0.5, fr;q=0.9', 'fr'],
    ['en, fr', 'en'],
    ['en;q=0, de', 'fr'],
    ['en;q=abc', 'fr'],
    ['de', 'fr'],
    ['*', 'fr'],
  ])('« %s » donne « %s »', (header, locale) => {
    expect(negotiateLocale(header)).toBe(locale)
  })
})
