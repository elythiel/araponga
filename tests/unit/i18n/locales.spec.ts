// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Messages = { [key: string]: string | Messages }

// Lus bruts : l'import JSON de Vite ajoute au module des exports nommés.
const read = (locale: string) => JSON.parse(readFileSync(`i18n/locales/${locale}.json`, 'utf8')) as Messages
const fr = read('fr')
const en = read('en')

function keysOf(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`))
}

describe('fichiers de locales', () => {
  it('ont exactement les mêmes clés en français et en anglais', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort())
  })

  it('n\'ont aucune traduction vide', () => {
    for (const messages of [fr, en]) {
      const empty = keysOf(messages).filter(key =>
        key.split('.').reduce<unknown>((node, part) => (node as Messages)[part], messages) === '')

      expect(empty).toEqual([])
    }
  })
})
