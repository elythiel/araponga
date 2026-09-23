import { createMediaStorage } from '../../services/storage'
import { resolveDataDir } from '../../utils/data-dir'
import { serveMedia } from '../../utils/serve-media'

export default defineEventHandler(event => serveMedia(event, createMediaStorage(resolveDataDir())))
