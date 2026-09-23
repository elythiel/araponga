import { setResponseHeader } from 'h3'
import { resolveSessionUser } from '../../utils/session-user'

export default defineEventHandler(async (event) => {
  const user = await resolveSessionUser(event)

  setResponseHeader(event, 'cache-control', 'no-store')

  return { user: user && { id: user.id, name: user.name, email: user.email, role: user.role } }
})
