<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import type { AdminSound } from '#shared/catalog'
import { SOUND_FILE_MAX_BYTES, SoundCreateSchema } from '#shared/schemas/sound'
import { validate } from '#shared/schemas/validation'
import { issuesByPath, issuesFromError, issuesFromValidation } from '~/utils/form-errors'
import type { FieldIssue } from '~/utils/form-errors'
import { parseTagList } from '~/utils/tag-list'

const props = defineProps<{
  sounds: readonly AdminSound[]
  /** Envoie le formulaire ; une erreur rejetée est affichée champ par champ. */
  upload: (form: FormData) => Promise<AdminSound>
}>()

const { t } = useI18n()

const formRef = useTemplateRef<HTMLFormElement>('form')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const file = shallowRef<File | null>(null)
const name = shallowRef('')
const description = shallowRef('')
const tags = shallowRef('')
const hotkey = shallowRef('')
/** Mesurée par le navigateur sur la prévisualisation, indicative. */
const durationMs = shallowRef<number | null>(null)

const issues = shallowRef<FieldIssue[]>([])
const state = shallowRef<'idle' | 'submitting' | 'success' | 'error'>('idle')
const lastAdded = shallowRef('')

const previewUrl = useObjectUrl(file)
const byPath = computed(() => issuesByPath(issues.value))

/** Nom proposé d'après le fichier ; remplacé tant qu'on ne l'a pas retouché. */
let suggestedName = ''

function onFileChange() {
  const chosen = fileInput.value?.files?.[0] ?? null

  file.value = chosen
  durationMs.value = null

  if (chosen && (name.value === '' || name.value === suggestedName)) {
    suggestedName = chosen.name.replace(/\.[^.]+$/, '')
    name.value = suggestedName
  }
}

function onMetadata(event: Event) {
  const { duration } = event.target as HTMLAudioElement

  durationMs.value = Number.isFinite(duration) ? Math.round(duration * 1000) : null
}

/** Champs texte tels que le multipart les transporte : tout en chaînes. */
const fields = computed(() => ({
  name: name.value,
  description: description.value,
  tags: JSON.stringify(parseTagList(tags.value)),
  hotkey: hotkey.value,
  ...(durationMs.value !== null && { durationMs: String(durationMs.value) }),
}))

function localIssues(): FieldIssue[] {
  const found: FieldIssue[] = []

  if (!file.value) {
    found.push({ path: 'file', code: 'required' })
  }
  else if (file.value.size > SOUND_FILE_MAX_BYTES) {
    // Refusé avant l'envoi : inutile de transférer 10 Mo pour une 413.
    found.push({ path: 'file', code: 'file_too_large' })
  }

  const result = validate(SoundCreateSchema, fields.value)

  return result.success ? found : [...found, ...issuesFromValidation(result.issues)]
}

async function showIssues(found: FieldIssue[]) {
  issues.value = found
  state.value = 'error'

  await nextTick()
  formRef.value?.querySelector<HTMLElement>('[aria-invalid="true"], [data-form-error]')?.focus()
}

function reset() {
  formRef.value?.reset()
  file.value = null
  name.value = ''
  description.value = ''
  tags.value = ''
  hotkey.value = ''
  durationMs.value = null
  suggestedName = ''
  issues.value = []
}

async function submit() {
  const found = localIssues()

  if (found.length > 0) {
    await showIssues(found)

    return
  }

  // Champs texte d'abord : le serveur les a en main quand le fichier arrive.
  const form = new FormData()

  for (const [key, value] of Object.entries(fields.value)) {
    form.append(key, value)
  }

  form.append('file', file.value!)

  state.value = 'submitting'

  try {
    const sound = await props.upload(form)

    reset()
    lastAdded.value = sound.name
    state.value = 'success'
  }
  catch (error) {
    await showIssues(issuesFromError(error))
  }
}
</script>

<template>
  <form
    ref="form"
    novalidate
    :data-state="state"
    @submit.prevent="submit"
  >
    <fieldset :disabled="state === 'submitting'">
      <legend>{{ t('admin.upload.legend') }}</legend>

      <div
        v-if="byPath['']"
        data-form-error
        tabindex="-1"
      >
        <AdminFieldError
          id="upload-form-error"
          :issue="byPath['']"
        />
      </div>

      <div>
        <label for="upload-file">{{ t('admin.upload.file') }}</label>
        <input
          id="upload-file"
          ref="fileInput"
          type="file"
          name="file"
          accept="audio/*,.mp3,.ogg,.wav,.m4a,.webm"
          required
          :aria-invalid="Boolean(byPath.file)"
          :aria-describedby="byPath.file ? 'upload-file-hint upload-file-error' : 'upload-file-hint'"
          @change="onFileChange"
        >
        <small id="upload-file-hint">{{ t('admin.upload.fileHint') }}</small>
        <AdminFieldError
          id="upload-file-error"
          :issue="byPath.file"
          :sounds="sounds"
        />
      </div>

      <figure v-if="previewUrl">
        <figcaption>{{ t('admin.upload.preview') }}</figcaption>
        <audio
          controls
          preload="metadata"
          :src="previewUrl"
          @loadedmetadata="onMetadata"
        />
      </figure>

      <AdminSoundFields
        v-model:name="name"
        v-model:description="description"
        v-model:tags="tags"
        v-model:hotkey="hotkey"
        id-prefix="upload"
        :issues="byPath"
        :sounds="sounds"
      />

      <button type="submit">
        {{ state === 'submitting' ? t('admin.upload.submitting') : t('admin.upload.submit') }}
      </button>
    </fieldset>

    <p
      role="status"
      data-upload-status
    >
      <template v-if="state === 'success'">
        {{ t('admin.upload.success', { name: lastAdded }) }}
      </template>
    </p>
  </form>
</template>
