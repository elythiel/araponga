import * as v from 'valibot'

/**
 * Touches assignables à un son : lettres, chiffres, touches de fonction. Les
 * raccourcis sont stockés en minuscules — `F1` et `f1` sont la même touche.
 */
export const HOTKEYS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
] as const

export type Hotkey = (typeof HOTKEYS)[number]

/** Une touche, normalisée en minuscules : la comparaison ignore la casse. */
export const HotkeySchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.picklist(HOTKEYS))
