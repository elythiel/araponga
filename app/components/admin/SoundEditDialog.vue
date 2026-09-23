<script setup lang="ts">
import type { AdminSound } from '#shared/catalog'
import { SoundUpdateSchema } from '#shared/schemas/sound'
import { validate } from '#shared/schemas/validation'
import type { SoundPatch } from '~/composables/useAdminSounds'
import { issuesByPath, issuesFromError, issuesFromValidation } from '~/utils/form-errors'
import type { FieldIssue } from '~/utils/form-errors'
import { formatTagList, parseTagList } from '~/utils/tag-list'

const props = defineProps<{
  /** Son en cours d'édition ; `null` ferme la boîte de dialogue. */
  sound: AdminSound | null
  sounds: readonly AdminSound[]
  update: (id: string, patch: SoundPatch) => Promise<AdminSound>
}>()

const emit = defineEmits<{
  close: []
  saved: [sound: AdminSound]
}>()

const { t } = useI18n()

const dialogRef = useTemplateRef<HTMLDialogElement>('dialog')
const formRef = useTemplateRef<HTMLFormElement>('form')

const name = shallowRef('')
const description = shallowRef('')
const tags = shallowRef('')
const hotkey = shallowRef('')
const issues = shallowRef<FieldIssue[]>([])
const saving = shallowRef(false)

const byPath = computed(() => issuesByPath(issues.value))

// Le <dialog> natif gère le focus, `Échap` et l'inertie du reste de la page.
watch(() => props.sound, (sound) => {
  if (!sound) {
    dialogRef.value?.close()

    return
  }

  name.value = sound.name
  description.value = sound.description ?? ''
  tags.value = formatTagList(sound.tags.map(tag => tag.name))
  hotkey.value = sound.hotkey ?? ''
  issues.value = []
  dialogRef.value?.showModal()
}, { flush: 'post' })

async function showIssues(found: FieldIssue[]) {
  issues.value = found

  await nextTick()
  formRef.value?.querySelector<HTMLElement>('[aria-invalid="true"], [data-form-error]')?.focus()
}

async function submit() {
  const sound = props.sound

  if (!sound) {
    return
  }

  const patch = {
    name: name.value,
    description: description.value,
    tags: parseTagList(tags.value),
    hotkey: hotkey.value,
  }

  const result = validate(SoundUpdateSchema, patch)

  if (!result.success) {
    await showIssues(issuesFromValidation(result.issues))

    return
  }

  saving.value = true

  try {
    emit('saved', await props.update(sound.id, patch))
  }
  catch (error) {
    await showIssues(issuesFromError(error))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="edit-title"
    @close="emit('close')"
  >
    <form
      v-if="sound"
      ref="form"
      novalidate
      :data-state="saving ? 'submitting' : 'idle'"
      @submit.prevent="submit"
    >
      <h2 id="edit-title">
        {{ t('admin.edit.title', { name: sound.name }) }}
      </h2>

      <div
        v-if="byPath['']"
        data-form-error
        tabindex="-1"
      >
        <AdminFieldError
          id="edit-form-error"
          :issue="byPath['']"
        />
      </div>

      <fieldset :disabled="saving">
        <AdminSoundFields
          v-model:name="name"
          v-model:description="description"
          v-model:tags="tags"
          v-model:hotkey="hotkey"
          id-prefix="edit"
          :issues="byPath"
          :sounds="sounds"
        />

        <button type="submit">
          {{ t('admin.edit.submit') }}
        </button>
        <button
          type="button"
          @click="dialogRef?.close()"
        >
          {{ t('admin.edit.cancel') }}
        </button>
      </fieldset>
    </form>
  </dialog>
</template>
