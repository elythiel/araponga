// Contenu du cookie de session (nuxt-auth-utils). Le rôle n'y figure pas :
// il est relu en base à chaque requête, pour qu'une rétrogradation prenne
// effet sans attendre une reconnexion.
declare module '#auth-utils' {
  interface User {
    id: string
  }

  interface UserSession {
    /** Dernière réémission du cookie, en epoch ms : la durée de 30 jours glisse. */
    refreshedAt?: number
  }
}

export {}
