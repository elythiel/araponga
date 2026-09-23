/** Formats d'affichage, toujours via `Intl` : jamais de concaténation à la main. */

export function formatBytes(bytes: number, locale: string): string {
  const [value, unit] = bytes >= 1024 * 1024
    ? [bytes / (1024 * 1024), 'megabyte']
    : [bytes / 1024, 'kilobyte']

  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value)
}

export function formatDuration(ms: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', maximumFractionDigits: 1 }).format(ms / 1000)
}

export function formatDate(epochMs: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(epochMs)
}
