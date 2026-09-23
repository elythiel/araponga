import { TagUpdateSchema } from '#shared/schemas/tag'
import { useDatabase } from '../../../database/client'
import { renameTag } from '../../../services/tags'
import { routeId } from '../../../utils/route-id'
import { parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const id = routeId(event)
  const { name } = await parseBody(event, TagUpdateSchema)

  return renameTag(useDatabase(), id, name)
})
