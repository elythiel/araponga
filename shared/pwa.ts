/**
 * Noms des caches du service worker. Fixes, sans version ni hash : un nom
 * dérivé de la version ferait perdre les sons en cache à chaque mise à jour.
 * Lus par la configuration du service worker et par la board.
 */
export const AUDIO_CACHE = 'araponga-audio'
export const PAGES_CACHE = 'araponga-pages'
export const CATALOG_CACHE = 'araponga-catalog'

/** Page « connexion requise », prérendue au build et servie à `/admin` hors ligne. */
export const OFFLINE_PAGE = '/offline'
