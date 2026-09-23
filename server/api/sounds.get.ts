import { SoundQuerySchema } from '#shared/schemas/sound'
import { useDatabase } from '../database/client'
import { getCatalog } from '../services/catalog'
import { parseQuery } from '../utils/validation'

export default defineEventHandler(event => getCatalog(useDatabase(), parseQuery(event, SoundQuerySchema)))
