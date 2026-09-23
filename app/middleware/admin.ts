/**
 * Confort, pas sécurité : la seule barrière est la garde serveur de
 * `/api/admin`. Sans session, on part directement vers la connexion ; avec
 * le rôle `user`, la page d'erreur 403 s'affiche telle quelle.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // `useRequestFetch` transmet le cookie de session lors du rendu serveur.
  const { user } = await useRequestFetch()('/api/auth/session')

  if (!user) {
    return navigateTo(`/api/auth/login?redirect=${encodeURIComponent(to.fullPath)}`, { external: true })
  }

  if (user.role !== 'admin') {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Forbidden' }))
  }
})
