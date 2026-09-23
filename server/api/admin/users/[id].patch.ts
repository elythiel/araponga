import { UserRoleUpdateSchema } from '#shared/schemas/user'
import { useDatabase } from '../../../database/client'
import { setUserRole } from '../../../services/users'
import { routeId } from '../../../utils/route-id'
import { parseBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const id = routeId(event)
  const { role } = await parseBody(event, UserRoleUpdateSchema)

  return setUserRole(useDatabase(), event.context.user!.id, id, role)
})
