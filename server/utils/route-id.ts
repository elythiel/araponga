import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import * as v from 'valibot'
import { IdSchema } from '#shared/schemas/id'
import { ApiError } from './errors'

/** Identifiant de la route : un identifiant mal formé désigne une ressource qui n'existe pas. */
export function routeId(event: H3Event): string {
  const result = v.safeParse(IdSchema, getRouterParam(event, 'id'))

  if (!result.success) {
    throw new ApiError('not_found')
  }

  return result.output
}
