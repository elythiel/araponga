import { sendNoContent } from 'h3'
import { SoundReorderSchema } from '#shared/schemas/sound'
import { useDatabase } from '../../../database/client'
import { reorderSounds } from '../../../services/sounds'
import { parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { ids } = await parseBody(event, SoundReorderSchema)

  reorderSounds(useDatabase(), ids)

  return sendNoContent(event)
})
