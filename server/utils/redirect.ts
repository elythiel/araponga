export const DEFAULT_REDIRECT = '/admin'

/**
 * Chemin interne : une barre oblique, puis rien qu'un navigateur puisse lire
 * comme un autre hôte. `//hote`, `/\hote` et les caractères de contrôle que
 * les navigateurs suppriment (`/\t/hote`) sont refusés.
 */
const INTERNAL_PATH = /^\/(?![/\\])[^\\]*$/

// eslint-disable-next-line no-control-regex -- les caractères de contrôle sont précisément ce qu'on cherche
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/

/**
 * Destination après connexion. Une valeur refusée est remplacée en silence
 * par la destination par défaut : pas de redirection ouverte, pas d'erreur
 * à exploiter.
 */
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && INTERNAL_PATH.test(value) && !CONTROL_CHARACTER.test(value)
    ? value
    : DEFAULT_REDIRECT
}
