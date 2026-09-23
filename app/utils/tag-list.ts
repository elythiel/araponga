/**
 * Saisie libre des tags, séparés par des virgules. Seuls les blancs et les
 * entrées vides sont écartés : la validation (longueur, doublons, nombre)
 * reste celle du schéma partagé.
 */
export function parseTagList(text: string): string[] {
  return text.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
}

export function formatTagList(names: string[]): string {
  return names.join(', ')
}
