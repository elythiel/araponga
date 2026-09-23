const LOCALES = ['fr', 'en'] as const

export type Locale = (typeof LOCALES)[number]

const DEFAULT_LOCALE: Locale = 'fr'

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * Langue d'une réponse d'après `Accept-Language` : la première langue prise
 * en charge par ordre de préférence (`q`), le français à défaut. Seule la
 * langue principale compte, `en-GB` vaut `en`.
 */
export function negotiateLocale(acceptLanguage: string | undefined): Locale {
  const ranges = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [range = '', ...parameters] = part.split(';').map(piece => piece.trim())
      const quality = parameters.find(parameter => parameter.startsWith('q='))

      return {
        language: range.toLowerCase().split('-')[0] ?? '',
        quality: quality === undefined ? 1 : Number(quality.slice(2)),
      }
    })
    // `q=0` signifie « surtout pas » ; une valeur illisible est écartée aussi.
    .filter(({ quality }) => quality > 0)
    // Tri stable : à qualité égale, l'ordre de l'en-tête départage.
    .sort((a, b) => b.quality - a.quality)

  for (const { language } of ranges) {
    if (language === '*') {
      return DEFAULT_LOCALE
    }

    if (isLocale(language)) {
      return language
    }
  }

  return DEFAULT_LOCALE
}
