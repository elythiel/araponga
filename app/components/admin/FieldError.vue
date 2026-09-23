<script setup lang="ts">
import type { AdminSound } from '#shared/catalog'
import type { FieldIssue } from '~/utils/form-errors'

const props = defineProps<{
  /** Identifiant du message, référencé par l'`aria-describedby` du champ. */
  id: string
  issue?: FieldIssue
  /** Catalogue, pour nommer le son en cause d'un conflit. */
  sounds?: readonly AdminSound[]
}>()

const { t, te } = useI18n()

const related = computed(() =>
  props.issue?.soundId ? props.sounds?.find(sound => sound.id === props.issue?.soundId) : undefined)

const message = computed(() => {
  const issue = props.issue

  if (!issue) {
    return ''
  }

  if (issue.code === 'hotkey_taken') {
    return related.value
      ? t('errors.hotkey_taken', { name: related.value.name })
      : t('errors.hotkey_taken_unknown')
  }

  const key = `errors.${issue.code}`

  return te(key) ? t(key, { min: issue.min, max: issue.max }) : t('errors.unknown')
})
</script>

<template>
  <p
    v-if="issue"
    :id="id"
    data-field-error
    :data-code="issue.code"
  >
    {{ message }}
    <a
      v-if="issue.code === 'duplicate_sound' && related"
      :href="`#sound-${related.id}`"
    >{{ t('errors.duplicateLink', { name: related.name }) }}</a>
  </p>
</template>
