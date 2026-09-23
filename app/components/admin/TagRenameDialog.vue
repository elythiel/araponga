<script setup lang="ts">
import type { CatalogTag } from '#shared/catalog'
import { TagUpdateSchema } from '#shared/schemas/tag'
import { validate } from '#shared/schemas/validation'
import { issuesByPath, issuesFromError, issuesFromValidation } from '~/utils/form-errors'
import type { FieldIssue } from '~/utils/form-errors'

const props = defineProps<{
  /** Tag en cours de renommage ; `null` ferme la boîte de dialogue. */
  tag: CatalogTag | null
  rename: (id: string, name: string) => Promise<CatalogTag>
}>()

const emit = defineEmits<{
  close: []
  saved: [tag: CatalogTag]
}>()

const { t } = useI18n()

const dialogRef = useTemplateRef<HTMLDialogElement>('dialog')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

const name = shallowRef('')
const issues = shallowRef<FieldIssue[]>([])
const saving = shallowRef(false)

const byPath = computed(() => issuesByPath(issues.value))
const nameIssue = computed(() => byPath.value.name ?? byPath.value[''])

watch(() => props.tag, (tag) => {
  if (!tag) {
    dialogRef.value?.close()

    return
  }

  name.value = tag.name
  issues.value = []
  dialogRef.value?.showModal()
}, { flush: 'post' })

async function submit() {
  const tag = props.tag

  if (!tag) {
    return
  }

  const result = validate(TagUpdateSchema, { name: name.value })

  if (!result.success) {
    issues.value = issuesFromValidation(result.issues)
    nameInput.value?.focus()

    return
  }

  saving.value = true

  try {
    emit('saved', await props.rename(tag.id, result.output.name))
  }
  catch (error) {
    issues.value = issuesFromError(error)
    await nextTick()
    nameInput.value?.focus()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="tag-rename-title"
    @close="emit('close')"
  >
    <form
      v-if="tag"
      novalidate
      @submit.prevent="submit"
    >
      <h2 id="tag-rename-title">
        {{ t('admin.tags.renameTitle', { name: tag.name }) }}
      </h2>

      <fieldset :disabled="saving">
        <div>
          <label for="tag-rename-name">{{ t('admin.tags.name') }}</label>
          <input
            id="tag-rename-name"
            ref="nameInput"
            v-model="name"
            type="text"
            name="name"
            autocomplete="off"
            required
            :aria-invalid="Boolean(nameIssue)"
            :aria-describedby="nameIssue ? 'tag-rename-name-error' : undefined"
          >
          <AdminFieldError
            id="tag-rename-name-error"
            :issue="nameIssue"
          />
        </div>

        <button type="submit">
          {{ t('admin.tags.save') }}
        </button>
        <button
          type="button"
          @click="dialogRef?.close()"
        >
          {{ t('admin.tags.cancel') }}
        </button>
      </fieldset>
    </form>
  </dialog>
</template>
