import * as v from 'valibot'

export const TAG_NAME_MAX_LENGTH = 32

/** Ligatures que la décomposition Unicode laisse entières. */
const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss' }

/**
 * Le slug porte l'unicité des tags : « Jeux vidéo », « jeux video » et
 * « JEUX-VIDÉO » donnent tous `jeux-video`. Il ne contient que des minuscules
 * ASCII et des chiffres, séparés par des tirets simples.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[œæß]/g, letter => LIGATURES[letter]!)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Un slug est sa propre normalisation : le format n'a pas d'autre définition. */
function isSlug(value: string): boolean {
  return value !== '' && slugify(value) === value
}

/** Nom affiché tel quel, pourvu qu'il donne un slug : « !!! » n'en donne pas. */
export const TagNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.maxLength(TAG_NAME_MAX_LENGTH),
  v.check(name => slugify(name) !== '', 'no_slug'),
)

export const TagSlugSchema = v.pipe(v.string(), v.check(isSlug, 'invalid_format'))

export const TagCreateSchema = v.object({
  name: TagNameSchema,
})

/** Le renommage est la seule modification possible d'un tag. */
export const TagUpdateSchema = v.object({
  name: TagNameSchema,
})
