<script setup lang="ts">
import type { CatalogTag } from '#shared/catalog'
import { TagCreateSchema } from '#shared/schemas/tag'
import { validate } from '#shared/schemas/validation'
import { issuesByPath, issuesFromError, issuesFromValidation } from '~/utils/form-errors'
import type { FieldIssue } from '~/utils/form-errors'

const props = defineProps<{
  create: (name: string) => Promise<{ tag: CatalogTag, created: boolean }>
}>()

const { t } = useI18n()

const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

const name = shallowRef('')
const issues = shallowRef<FieldIssue[]>([])
const submitting = shallowRef(false)
const message = shallowRef('')

const byPath = computed(() => issuesByPath(issues.value))

async function showIssues(found: FieldIssue[]) {
  issues.value = found
  await nextTick()
  nameInput.value?.focus()
}

async function submit() {
  message.value = ''

  const result = validate(TagCreateSchema, { name: name.value })

  if (!result.success) {
    await showIssues(issuesFromValidation(result.issues))

    return
  }

  submitting.value = true

  try {
    const { tag, created } = await props.create(result.output.name)

    name.value = ''
    issues.value = []
    message.value = t(created ? 'admin.tags.created' : 'admin.tags.existed', { name: tag.name })
  }
  catch (error) {
    await showIssues(issuesFromError(error))
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <form
    novalidate
    :data-state="submitting ? 'submitting' : 'idle'"
    @submit.prevent="submit"
  >
    <fieldset :disabled="submitting">
      <legend>{{ t('admin.tags.legend') }}</legend>

      <div>
        <label for="tag-create-name">{{ t('admin.tags.name') }}</label>
        <input
          id="tag-create-name"
          ref="nameInput"
          v-model="name"
          type="text"
          name="name"
          autocomplete="off"
          required
          :aria-invalid="Boolean(byPath.name || byPath[''])"
          :aria-describedby="byPath.name || byPath[''] ? 'tag-create-name-error' : undefined"
        >
        <AdminFieldError
          id="tag-create-name-error"
          :issue="byPath.name ?? byPath['']"
        />
      </div>

      <button type="submit">
        {{ t('admin.tags.submit') }}
      </button>
    </fieldset>

    <p
      role="status"
      data-tag-create-status
    >
      {{ message }}
    </p>
  </form>
</template>
