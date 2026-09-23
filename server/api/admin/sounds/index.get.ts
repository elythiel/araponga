import { useDatabase } from '../../../database/client'
import { getAdminCatalog } from '../../../services/sounds'

export default defineEventHandler(() => getAdminCatalog(useDatabase()))
