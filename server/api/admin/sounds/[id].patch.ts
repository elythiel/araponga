import { SoundUpdateSchema } from '#shared/schemas/sound'
import { useDatabase } from '../../../database/client'
import { updateSound } from '../../../services/sounds'
import { routeId } from '../../../utils/route-id'
import { parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const id = routeId(event)

  return updateSound(useDatabase(), id, await parseBody(event, SoundUpdateSchema))
})
