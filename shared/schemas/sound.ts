import * as v from 'valibot'
import { HotkeySchema } from './hotkey'
import { IdSchema } from './id'
import { TagNameSchema, TagSlugSchema, slugify } from './tag'

export const SOUND_NAME_MAX_LENGTH = 80
export const SOUND_DESCRIPTION_MAX_LENGTH = 280
export const SOUND_TAGS_MAX = 10
export const SOUND_QUERY_MAX_LENGTH = 80
/** 10 Mo : au-delà, l'upload est coupé sans que le reste du flux soit lu. */
export const SOUND_FILE_MAX_BYTES = 10 * 1024 * 1024

/**
 * Champ facultatif d'un formulaire : une chaîne vide ou blanche vaut `null`,
 * ce qui efface la valeur au lieu de la refuser.
 */
function clearable<TOutput>(schema: v.GenericSchema<string, TOutput>) {
  return v.nullable(v.pipe(
    v.string(),
    v.transform(value => (value.trim() === '' ? null : value)),
    v.nullable(schema),
  ))
}

function uniqueBySlug(names: string[]): string[] {
  const seen = new Set<string>()

  return names.filter((name) => {
    const slug = slugify(name)

    if (seen.has(slug)) {
      return false
    }

    seen.add(slug)

    return true
  })
}

const SoundNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.maxLength(SOUND_NAME_MAX_LENGTH),
)

const DescriptionSchema = v.pipe(v.string(), v.trim(), v.maxLength(SOUND_DESCRIPTION_MAX_LENGTH))

/**
 * Tags d'un son, désignés par leur nom : un slug existant en est un cas
 * particulier, puisque `slugify` le laisse intact. Deux noms au même slug
 * sont un seul tag — on les fusionne avant de compter.
 */
const SoundTagsSchema = v.pipe(
  v.array(TagNameSchema),
  v.transform(uniqueBySlug),
  v.maxLength(SOUND_TAGS_MAX),
)

/** Durée mesurée par le navigateur, transmise en texte par le multipart. */
const DurationFieldSchema = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(0))

/**
 * Champs texte de l'upload (`multipart/form-data`) : tout y arrive en chaîne,
 * `tags` en JSON. Le fichier lui-même est contrôlé à part, par signature.
 */
export const SoundCreateSchema = v.object({
  name: SoundNameSchema,
  description: v.optional(clearable(DescriptionSchema), null),
  tags: v.optional(v.pipe(v.string(), v.parseJson(), SoundTagsSchema), '[]'),
  hotkey: v.optional(clearable(HotkeySchema), null),
  durationMs: v.optional(clearable(DurationFieldSchema), null),
})

/**
 * Édition partielle en JSON : un champ absent est conservé, `null` ou une
 * chaîne vide efface la description ou le raccourci.
 */
export const SoundUpdateSchema = v.object({
  name: v.optional(SoundNameSchema),
  description: v.optional(clearable(DescriptionSchema)),
  tags: v.optional(SoundTagsSchema),
  hotkey: v.optional(clearable(HotkeySchema)),
})

/**
 * Nouvel ordre complet du catalogue. Que la liste couvre exactement les sons
 * existants ne se vérifie qu'en base ; ici, seulement sa forme.
 */
export const SoundReorderSchema = v.object({
  ids: v.pipe(
    v.array(IdSchema),
    v.check(ids => new Set(ids).size === ids.length, 'duplicate'),
  ),
})

/**
 * Query string du catalogue. Une clé répétée arrive en tableau, une clé
 * unique en chaîne ; une valeur vide vaut absence.
 */
export const SoundQuerySchema = v.object({
  q: v.optional(v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(SOUND_QUERY_MAX_LENGTH),
    v.transform(q => q || undefined),
  )),
  tags: v.optional(v.pipe(
    v.union([v.string(), v.array(v.string())]),
    v.transform(value => [value].flat().filter(slug => slug !== '')),
    v.array(TagSlugSchema),
  ), []),
})

export type SoundQuery = v.InferOutput<typeof SoundQuerySchema>
