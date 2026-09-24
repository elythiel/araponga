export const PAGE_SIZE = 48

/** Numéro de page lu dans l'URL : tout ce qui n'est pas un entier ≥ 1 vaut 1. */
export function parsePage(value: unknown): number {
  const page = Number(Array.isArray(value) ? value[0] : value)

  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

export function pageCountOf(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function pageSlice<TItem>(items: readonly TItem[], page: number, pageSize: number = PAGE_SIZE): TItem[] {
  return items.slice((page - 1) * pageSize, page * pageSize)
}

/**
 * Numéros à afficher : la première et la dernière page, la page courante et
 * ses voisines ; un trou (`'gap'`) remplace chaque série sautée.
 * `1 … 4 [5] 6 … 11`
 */
export function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter(number => number >= 1 && number <= pageCount)
    .sort((a, b) => a - b)

  return shown.flatMap((number, index) => {
    const previous = shown[index - 1]

    return previous !== undefined && number - previous > 1 ? ['gap' as const, number] : [number]
  })
}
