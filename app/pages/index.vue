<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import type { Catalog, CatalogSound } from '#shared/catalog'

const { t } = useI18n()

useHead({ title: () => t('board.title') })

// Rendu serveur puis hydraté : la grille est là avant le JavaScript.
const { data } = await useFetch<Catalog>('/api/sounds', { key: 'catalog' })

const sounds = computed(() => data.value?.sounds ?? [])
// Un tag sans son ne filtrerait rien : la board ne le propose pas.
const tags = computed(() => (data.value?.tags ?? []).filter(tag => tag.soundCount > 0))

const player = useSoundPlayer()
const { playingCount, playingIds, failedIds } = player

// Lu après le montage : le serveur ne voit pas le localStorage, et le
// premier rendu client doit rester identique au sien.
const volume = useStorage('araponga-volume', 1, undefined, { initOnMounted: true })

watch(volume, value => player.setVolume(value), { immediate: true })

const { search, selectedTags, results, page, pageCount, pageItems, toggleTag, reset, pageLink }
  = useSoundFilters(sounds)

function play(sound: CatalogSound) {
  void player.play(sound)
}

useHotkeys(sounds, {
  play,
  stopAll: player.stopAll,
  focusSearch: () => document.getElementById('board-search')?.focus(),
})

/**
 * Après un changement de page demandé par la navigation, le focus va au
 * titre de la grille, qui annonce la nouvelle page. Pas quand la page change
 * parce qu'on tape une recherche : le focus doit rester dans le champ.
 */
const gridTitle = useTemplateRef<HTMLHeadingElement>('gridTitle')
let focusGridOnPageChange = false

function onNavigate() {
  focusGridOnPageChange = true
}

watch(page, async () => {
  if (focusGridOnPageChange) {
    focusGridOnPageChange = false
    await nextTick()
    gridTitle.value?.focus()
  }
})

/** Seuls le début d'une lecture et la fin globale sont annoncés. */
const announcement = shallowRef('')

watch(playingCount, (count, previous) => {
  if (previous === 0 && count > 0) {
    announcement.value = t('board.status.playing')
  }
  else if (previous > 0 && count === 0) {
    announcement.value = t('board.status.stopped')
  }
})
</script>

<template>
  <div>
    <header>
      <h1>{{ t('board.title') }}</h1>
      <BoardSearch v-model="search" />
      <BoardTagFilters
        :tags="tags"
        :selected="selectedTags"
        @toggle="toggleTag"
      />
      <BoardVolume v-model="volume" />
      <BoardLanguageSwitcher />
    </header>

    <main>
      <h2
        id="board-grid-title"
        ref="gridTitle"
        tabindex="-1"
      >
        {{ t('board.grid.title', { page, pageCount }) }}
        —
        {{ t('board.grid.count', results.length) }}
      </h2>

      <BoardEmptyCatalog v-if="sounds.length === 0" />

      <p
        v-else-if="results.length === 0"
        data-state="no-results"
      >
        {{ t('board.empty.results') }}
        <button
          type="button"
          class="min-h-11 min-w-11"
          @click="reset"
        >
          {{ t('board.empty.reset') }}
        </button>
      </p>

      <BoardSoundGrid
        v-else
        :sounds="pageItems"
        :playing-ids="playingIds"
        :failed-ids="failedIds"
        @play="play"
      />

      <BoardPageNav
        v-if="pageCount > 1"
        :page="page"
        :page-count="pageCount"
        :link="pageLink"
        @navigate="onNavigate"
      />
    </main>

    <footer>
      <button
        type="button"
        class="min-h-11 min-w-11"
        data-action="stop-all"
        aria-keyshortcuts="Escape"
        :disabled="playingCount === 0"
        @click="player.stopAll"
      >
        {{ playingCount === 0 ? t('board.stopAll.idle') : t('board.stopAll.active', { count: playingCount }) }}
      </button>
      <NuxtLink
        to="/admin"
        class="inline-block min-h-11 min-w-11"
      >
        {{ t('board.admin') }}
      </NuxtLink>
    </footer>

    <p
      role="status"
      data-playback-status
    >
      {{ announcement }}
    </p>
  </div>
</template>
