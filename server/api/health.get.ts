import { setResponseStatus } from 'h3'
import { useDatabase } from '../database/client'
import { checkHealth } from '../services/health'

export default defineEventHandler((event) => {
  const health = checkHealth(useDatabase, useRuntimeConfig().appVersion)

  // Un healthcheck ne lit que le statut HTTP : l'échec doit s'y voir.
  if (health.status !== 'ok') {
    setResponseStatus(event, 503)
  }

  return health
})
