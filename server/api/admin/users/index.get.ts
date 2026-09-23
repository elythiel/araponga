import { useDatabase } from '../../../database/client'
import { listUsers } from '../../../services/users'

export default defineEventHandler(() => listUsers(useDatabase()))
