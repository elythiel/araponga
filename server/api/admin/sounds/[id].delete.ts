import { sendNoContent } from 'h3'
import { useDatabase } from '../../../database/client'
import { deleteSound } from '../../../services/sounds'
import { createMediaStorage } from '../../../services/storage'
import { resolveDataDir } from '../../../utils/data-dir'
import { routeId } from '../../../utils/route-id'

export default defineEventHandler(async (event) => {
  await deleteSound(useDatabase(), createMediaStorage(resolveDataDir()), routeId(event))

  return sendNoContent(event)
})
