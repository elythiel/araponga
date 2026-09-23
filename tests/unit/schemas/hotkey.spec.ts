// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { HOTKEYS, HotkeySchema } from '../../../shared/schemas/hotkey'
import { issuesOf, outputOf } from './helpers'

describe('HotkeySchema', () => {
  it('couvre a–z, 0–9 et F1–F12, sans doublon', () => {
    expect(HOTKEYS).toHaveLength(26 + 10 + 12)
    expect(new Set(HOTKEYS).size).toBe(HOTKEYS.length)
  })

  it.each([
    ['a', 'a'],
    ['Z', 'z'],
    ['0', '0'],
    ['9', '9'],
    ['F1', 'f1'],
    ['f12', 'f12'],
    [' b ', 'b'],
  ])('accepte « %s » et le stocke en « %s »', (input, expected) => {
    expect(outputOf(HotkeySchema, input)).toBe(expected)
  })

  it.each(['', ' ', 'aa', 'é', '-', 'f0', 'F13', 'Enter', 'Escape', 'ctrl+a'])(
    'refuse « %s »',
    (input) => {
      expect(issuesOf(HotkeySchema, input)).toEqual([{ path: '', code: 'invalid_value' }])
    },
  )

  it('refuse autre chose qu\'une chaîne', () => {
    expect(issuesOf(HotkeySchema, 1)).toEqual([{ path: '', code: 'invalid_type' }])
    expect(issuesOf(HotkeySchema, null)).toEqual([{ path: '', code: 'required' }])
  })
})
