import { sendNoContent } from 'h3'
import { useDatabase } from '../../../database/client'
import { deleteUser } from '../../../services/users'
import { routeId } from '../../../utils/route-id'

export default defineEventHandler((event) => {
  deleteUser(useDatabase(), routeId(event))

  return sendNoContent(event)
})
