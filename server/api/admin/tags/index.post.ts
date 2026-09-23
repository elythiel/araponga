import { setResponseStatus } from 'h3'
import { TagCreateSchema } from '#shared/schemas/tag'
import { useDatabase } from '../../../database/client'
import { createTag } from '../../../services/tags'
import { parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { name } = await parseBody(event, TagCreateSchema)
  const { tag, created } = createTag(useDatabase(), name)

  // Un slug existant renvoie le tag existant en 200 : ce n'est pas une erreur.
  setResponseStatus(event, created ? 201 : 200)

  return tag
})
