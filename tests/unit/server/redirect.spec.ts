// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEFAULT_REDIRECT, safeRedirect } from '../../../server/utils/redirect'

describe('safeRedirect', () => {
  it.each(['/', '/admin/tags', '/?tags=blagues&q=tada', '/admin#liste'])('garde le chemin interne %s', (path) => {
    expect(safeRedirect(path)).toBe(path)
  })

  it.each([
    ['absente', undefined],
    ['vide', ''],
    ['en tableau', ['/admin']],
    ['absolue', 'https://evil.example.com'],
    ['relative au protocole', '//evil.example.com'],
    ['avec une barre inverse', '/\\evil.example.com'],
    ['avec une tabulation que le navigateur supprimerait', '/\t/evil.example.com'],
    ['avec un saut de ligne', '/admin\r\nSet-Cookie: x=1'],
    ['relative sans barre', 'admin'],
    ['en javascript:', 'javascript:alert(1)'],
  ])('remplace une destination %s par la valeur par défaut', (_, value) => {
    expect(safeRedirect(value)).toBe(DEFAULT_REDIRECT)
  })
})
