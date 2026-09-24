import { useDebounceFn } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { filterSounds } from '#shared/catalog'
import type { CatalogSound } from '#shared/catalog'
import { SoundQuerySchema } from '#shared/schemas/sound'
import { validate } from '#shared/schemas/validation'
import { pageCountOf, pageSlice, parsePage } from '~/utils/pagination'

/** Délai entre la dernière frappe et la mise à jour de l'URL, donc du filtre. */
export const SEARCH_DEBOUNCE_MS = 150

interface BoardQuery {
  q?: string
  tags: string[]
  page: number
}

/**
 * État de la board lu dans l'URL, qui en est la seule source : une sélection
 * se partage et survit au rechargement. Chaque paramètre est lu à part — un
 * tag mal formé n'efface pas la recherche.
 */
export function readBoardQuery(query: LocationQuery): BoardQuery {
  const q = validate(SoundQuerySchema, { q: query.q ?? undefined })
  const tags = validate(SoundQuerySchema, { tags: query.tags ?? undefined })

  return {
    q: q.success ? q.output.q : undefined,
    tags: tags.success ? tags.output.tags : [],
    page: parsePage(query.page),
  }
}

export function toRouteQuery({ q, tags, page }: BoardQuery): LocationQueryRaw {
  return {
    ...(q && { q }),
    ...(tags.length > 0 && { tags }),
    ...(page > 1 && { page: String(page) }),
  }
}

/**
 * Recherche, filtres par tag et pagination de la board, synchronisés avec la
 * query string. Toute la liste est filtrée côté client ; seule une page
 * (48 sons) est affichée. Changer la recherche ou les tags ramène en page 1.
 */
export function useSoundFilters(sounds: MaybeRefOrGetter<readonly CatalogSound[]>) {
  const route = useRoute()
  const router = useRouter()

  const query = computed(() => readBoardQuery(route.query))

  /** Contenu du champ, immédiat ; l'URL, et donc le filtre, suit après le debounce. */
  const search = shallowRef(query.value.q ?? '')

  function update(patch: Partial<BoardQuery>) {
    return router.replace({ query: toRouteQuery({ ...query.value, ...patch }) })
  }

  const commitSearch = useDebounceFn((value: string) => {
    const q = value.trim() || undefined

    if (q !== query.value.q) {
      void update({ q, page: 1 })
    }
  }, SEARCH_DEBOUNCE_MS)

  watch(search, value => commitSearch(value))

  // Retour arrière, lien partagé : le champ reflète l'URL.
  watch(() => query.value.q, (q) => {
    if ((q ?? '') !== search.value.trim()) {
      search.value = q ?? ''
    }
  })

  const results = computed(() => filterSounds([...toValue(sounds)], { q: query.value.q, tags: query.value.tags }))
  const pageCount = computed(() => pageCountOf(results.value.length))
  // Une page au-delà de la dernière (lien ancien, catalogue réduit) vaut la page 1.
  const page = computed(() => (query.value.page > pageCount.value ? 1 : query.value.page))
  const pageItems = computed(() => pageSlice(results.value, page.value))
  const selectedTags = computed(() => query.value.tags)

  function toggleTag(slug: string) {
    const tags = selectedTags.value.includes(slug)
      ? selectedTags.value.filter(selected => selected !== slug)
      : [...selectedTags.value, slug]

    return update({ tags, page: 1 })
  }

  function reset() {
    search.value = ''

    return router.replace({ query: {} })
  }

  /** Lien d'une page, pour de vrais liens de navigation. */
  function pageLink(target: number) {
    return { query: toRouteQuery({ ...query.value, page: target }) }
  }

  return { search, selectedTags, results, page, pageCount, pageItems, toggleTag, reset, pageLink }
}
