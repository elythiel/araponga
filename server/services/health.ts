import { sql } from 'drizzle-orm'
import type { Database } from '../database/client'

export type HealthState = 'ok' | 'error'

export interface Health {
  status: HealthState
  version: string
  database: HealthState
}

/**
 * État de l'instance pour le healthcheck Docker. Ne révèle que la version et
 * l'état de la base : la cause d'un échec part dans les logs.
 *
 * La base est demandée par un accesseur, pour qu'une connexion jamais ouverte
 * compte comme une base en échec plutôt que comme une erreur de la route.
 */
export function checkHealth(database: () => Database, version: string): Health {
  let state: HealthState = 'ok'

  try {
    database().get(sql`SELECT 1`)
  }
  catch (error) {
    console.error('[health] base de données injoignable', error)
    state = 'error'
  }

  return { status: state, version, database: state }
}
