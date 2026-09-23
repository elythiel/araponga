<script setup lang="ts">
import type { AdminSound } from '#shared/catalog'
import type { FieldIssue } from '~/utils/form-errors'

/**
 * Champs texte d'un son, communs à l'ajout et à l'édition : chaque champ
 * porte sa propre erreur, liée par `aria-describedby`.
 */
const props = defineProps<{
  /** Préfixe des identifiants : deux formulaires coexistent sur la page. */
  idPrefix: string
  issues: Record<string, FieldIssue>
  sounds: readonly AdminSound[]
}>()

const name = defineModel<string>('name', { required: true })
const description = defineModel<string>('description', { required: true })
const tags = defineModel<string>('tags', { required: true })
const hotkey = defineModel<string>('hotkey', { required: true })

const { t } = useI18n()

const idOf = (field: string) => `${props.idPrefix}-${field}`
const errorIdOf = (field: string) => `${props.idPrefix}-${field}-error`

/** Aide du champ, puis son erreur éventuelle. */
function describedBy(field: string, hint?: boolean): string | undefined {
  const ids = [hint && `${idOf(field)}-hint`, props.issues[field] && errorIdOf(field)].filter(Boolean)

  return ids.length > 0 ? ids.join(' ') : undefined
}
</script>

<template>
  <div>
    <label :for="idOf('name')">{{ t('admin.upload.name') }}</label>
    <input
      :id="idOf('name')"
      v-model="name"
      type="text"
      name="name"
      autocomplete="off"
      required
      :aria-invalid="Boolean(issues.name)"
      :aria-describedby="describedBy('name')"
    >
    <AdminFieldError
      :id="errorIdOf('name')"
      :issue="issues.name"
    />
  </div>

  <div>
    <label :for="idOf('description')">{{ t('admin.upload.description') }}</label>
    <textarea
      :id="idOf('description')"
      v-model="description"
      name="description"
      :aria-invalid="Boolean(issues.description)"
      :aria-describedby="describedBy('description')"
    />
    <AdminFieldError
      :id="errorIdOf('description')"
      :issue="issues.description"
    />
  </div>

  <div>
    <label :for="idOf('tags')">{{ t('admin.upload.tags') }}</label>
    <input
      :id="idOf('tags')"
      v-model="tags"
      type="text"
      name="tags"
      autocomplete="off"
      :aria-invalid="Boolean(issues.tags)"
      :aria-describedby="describedBy('tags', true)"
    >
    <small :id="`${idOf('tags')}-hint`">{{ t('admin.upload.tagsHint') }}</small>
    <AdminFieldError
      :id="errorIdOf('tags')"
      :issue="issues.tags"
    />
  </div>

  <div>
    <label :for="idOf('hotkey')">{{ t('admin.upload.hotkey') }}</label>
    <input
      :id="idOf('hotkey')"
      v-model="hotkey"
      type="text"
      name="hotkey"
      autocomplete="off"
      maxlength="3"
      :aria-invalid="Boolean(issues.hotkey)"
      :aria-describedby="describedBy('hotkey', true)"
    >
    <small :id="`${idOf('hotkey')}-hint`">{{ t('admin.upload.hotkeyHint') }}</small>
    <AdminFieldError
      :id="errorIdOf('hotkey')"
      :issue="issues.hotkey"
      :sounds="sounds"
    />
  </div>
</template>
