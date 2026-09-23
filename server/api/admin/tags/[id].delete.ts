import { getQuery, sendNoContent } from 'h3'
import { useDatabase } from '../../../database/client'
import { deleteTag } from '../../../services/tags'
import { routeId } from '../../../utils/route-id'

export default defineEventHandler((event) => {
  deleteTag(useDatabase(), routeId(event), getQuery(event).force === 'true')

  return sendNoContent(event)
})
