<script setup lang="ts">
import { insertNodeAt, removeNode, useSortable } from '@vueuse/integrations/useSortable'
import type { AdminSound } from '#shared/catalog'
import { filterSounds } from '#shared/catalog'
import { formatBytes, formatDate, formatDuration } from '~/utils/format'

const props = defineProps<{
  /** Dans l'ordre de la board. */
  sounds: readonly AdminSound[]
}>()

const emit = defineEmits<{
  edit: [id: string]
  remove: [id: string]
  /** Nouvel ordre complet de la board. */
  reorder: [ids: string[]]
}>()

const { t, locale } = useI18n()

type SortKey = 'position' | 'name' | 'hotkey' | 'durationMs' | 'sizeBytes' | 'createdAt'
type Direction = 'ascending' | 'descending'

const COLUMNS: Array<{ key: SortKey, label: string }> = [
  { key: 'position', label: 'admin.sounds.columns.position' },
  { key: 'name', label: 'admin.sounds.columns.name' },
  { key: 'hotkey', label: 'admin.sounds.columns.hotkey' },
  { key: 'durationMs', label: 'admin.sounds.columns.duration' },
  { key: 'sizeBytes', label: 'admin.sounds.columns.size' },
  { key: 'createdAt', label: 'admin.sounds.columns.createdAt' },
]

const query = shallowRef('')
const sortKey = shallowRef<SortKey>('position')
const direction = shallowRef<Direction>('ascending')
/** Dernier déplacement, annoncé aux lecteurs d'écran. */
const announcement = shallowRef('')

const tableRef = useTemplateRef<HTMLTableElement>('table')
const bodyRef = useTemplateRef<HTMLTableSectionElement>('body')

/** Rang de chaque son dans la board, affiché quel que soit le tri. */
const rankOf = computed(() => new Map(props.sounds.map((sound, index) => [sound.id, index + 1])))

/**
 * Réordonner n'a de sens que sur la liste complète, dans l'ordre de la
 * board : déplacer une ligne d'une vue triée ou filtrée serait ambigu.
 */
const canReorder = computed(() =>
  sortKey.value === 'position' && direction.value === 'ascending' && query.value.trim() === '')

function compare(a: AdminSound, b: AdminSound): number {
  const key = sortKey.value

  if (key === 'position') {
    return rankOf.value.get(a.id)! - rankOf.value.get(b.id)!
  }

  const [left, right] = [a[key], b[key]]

  // Les valeurs absentes (raccourci, durée) vont toujours en fin de liste.
  if (left === null || right === null) {
    return left === right ? 0 : left === null ? 1 : -1
  }

  const order = typeof left === 'string'
    ? left.localeCompare(right as string, locale.value)
    : left - (right as number)

  return direction.value === 'ascending' ? order : -order
}

const visibleSounds = computed(() => {
  const found = filterSounds([...props.sounds], { q: query.value.trim() || undefined, tags: [] })
  const sorted = found.sort(compare)

  return sortKey.value === 'position' && direction.value === 'descending' ? sorted.reverse() : sorted
})

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    direction.value = direction.value === 'ascending' ? 'descending' : 'ascending'

    return
  }

  sortKey.value = key
  direction.value = 'ascending'
}

function ariaSort(key: SortKey): Direction | undefined {
  return sortKey.value === key ? direction.value : undefined
}

function moved(ids: string[], from: number, to: number): string[] {
  const next = [...ids]
  const [id] = next.splice(from, 1)

  next.splice(to, 0, id!)

  return next
}

/**
 * Alternative clavier au glisser-déposer. Le focus reste sur la ligne
 * déplacée, pour enchaîner les appuis ; il passe sur l'autre bouton quand
 * celui-ci devient inactif, en haut ou en bas de la liste.
 */
async function move(sound: AdminSound, offset: -1 | 1) {
  const ids = props.sounds.map(item => item.id)
  const from = ids.indexOf(sound.id)
  const to = from + offset

  if (to < 0 || to >= ids.length) {
    return
  }

  emit('reorder', moved(ids, from, to))
  announcement.value = t('admin.sounds.moved', { name: sound.name, position: to + 1, total: ids.length })

  await nextTick()

  const row = tableRef.value?.querySelector(`[data-sound-id="${sound.id}"]`)
  const same = row?.querySelector<HTMLButtonElement>(`[data-action="${offset < 0 ? 'up' : 'down'}"]`)
  const other = row?.querySelector<HTMLButtonElement>(`[data-action="${offset < 0 ? 'down' : 'up'}"]`)

  ;(same && !same.disabled ? same : other)?.focus()
}

const { option } = useSortable(bodyRef, [], {
  handle: '[data-drag-handle]',
  animation: 0,
  onUpdate(event) {
    const { oldIndex, newIndex } = event

    // Sortable a déjà déplacé la ligne : on la remet en place pour que Vue,
    // seul maître du DOM, la redessine d'après le nouvel ordre.
    removeNode(event.item)
    insertNodeAt(event.from, event.item, oldIndex!)

    if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
      emit('reorder', moved(props.sounds.map(sound => sound.id), oldIndex, newIndex))
    }
  },
})

onMounted(() => option('disabled', !canReorder.value))
watch(canReorder, value => option('disabled', !value))
</script>

<template>
  <section
    aria-labelledby="sounds-caption"
    :data-reorderable="canReorder"
  >
    <p>
      <label for="sounds-search">{{ t('admin.sounds.search') }}</label>
      <input
        id="sounds-search"
        v-model="query"
        type="search"
        autocomplete="off"
      >
    </p>

    <p
      v-if="!canReorder && sounds.length > 1"
      id="reorder-disabled"
    >
      {{ t('admin.sounds.reorderDisabled') }}
    </p>

    <p
      v-if="sounds.length === 0"
      data-state="empty"
    >
      {{ t('admin.sounds.empty') }}
    </p>

    <p
      v-else-if="visibleSounds.length === 0"
      data-state="no-results"
    >
      {{ t('admin.sounds.noResults') }}
    </p>

    <table
      v-show="visibleSounds.length > 0"
      ref="table"
    >
      <caption id="sounds-caption">
        {{ t('admin.sounds.caption') }} — {{ t('admin.sounds.count', sounds.length) }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            :aria-sort="ariaSort(column.key)"
          >
            <button
              type="button"
              :aria-label="t('admin.sounds.sortBy', { column: t(column.label) })"
              @click="sortBy(column.key)"
            >
              {{ t(column.label) }}
            </button>
          </th>
          <th scope="col">
            {{ t('admin.sounds.columns.tags') }}
          </th>
          <th scope="col">
            {{ t('admin.sounds.columns.actions') }}
          </th>
        </tr>
      </thead>
      <tbody ref="body">
        <tr
          v-for="sound in visibleSounds"
          :id="`sound-${sound.id}`"
          :key="sound.id"
          :data-sound-id="sound.id"
        >
          <td>
            <span
              v-if="canReorder"
              data-drag-handle
              aria-hidden="true"
            >{{ t('admin.sounds.drag') }}</span>
            {{ rankOf.get(sound.id) }}
          </td>
          <th scope="row">
            {{ sound.name }}
          </th>
          <td>{{ sound.hotkey?.toUpperCase() ?? t('admin.sounds.none') }}</td>
          <td>{{ sound.durationMs === null ? t('admin.sounds.none') : formatDuration(sound.durationMs, locale) }}</td>
          <td>{{ formatBytes(sound.sizeBytes, locale) }}</td>
          <td>{{ formatDate(sound.createdAt, locale) }}</td>
          <td>{{ sound.tags.map(tag => tag.name).join(', ') || t('admin.sounds.none') }}</td>
          <td>
            <button
              type="button"
              data-action="up"
              :disabled="!canReorder || rankOf.get(sound.id) === 1"
              :aria-describedby="canReorder ? undefined : 'reorder-disabled'"
              @click="move(sound, -1)"
            >
              {{ t('admin.sounds.moveUp', { name: sound.name }) }}
            </button>
            <button
              type="button"
              data-action="down"
              :disabled="!canReorder || rankOf.get(sound.id) === sounds.length"
              :aria-describedby="canReorder ? undefined : 'reorder-disabled'"
              @click="move(sound, 1)"
            >
              {{ t('admin.sounds.moveDown', { name: sound.name }) }}
            </button>
            <button
              type="button"
              data-action="edit"
              @click="emit('edit', sound.id)"
            >
              {{ t('admin.sounds.edit', { name: sound.name }) }}
            </button>
            <button
              type="button"
              data-action="delete"
              @click="emit('remove', sound.id)"
            >
              {{ t('admin.sounds.delete', { name: sound.name }) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <p
      role="status"
      data-reorder-status
    >
      {{ announcement }}
    </p>
  </section>
</template>
