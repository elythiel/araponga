import { useDatabase } from '../../../database/client'
import { listTags } from '../../../services/tags'

export default defineEventHandler(() => listTags(useDatabase()))
