import { getRequestHeader, setResponseHeader, setResponseStatus } from 'h3'
import { SOUND_FILE_MAX_BYTES } from '#shared/schemas/sound'
import { useDatabase } from '../../../database/client'
import { createSound } from '../../../services/sounds'
import { createMediaStorage } from '../../../services/storage'
import { resolveDataDir } from '../../../utils/data-dir'
import { ApiError } from '../../../utils/errors'
import { createRateLimiter } from '../../../utils/rate-limit'
import { FILE_FIELD, MULTIPART_OVERHEAD_BYTES, readSoundUpload } from '../../../utils/sound-upload'

/** 30 uploads par tranche de 10 minutes et par compte (docs/03-api.md). */
const uploads = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 })

export default defineEventHandler(async (event) => {
  // La garde de /api/admin a posé l'utilisateur : il existe forcément ici.
  const user = event.context.user!
  const retryAfterMs = uploads.hit(user.id)

  if (retryAfterMs !== null) {
    setResponseHeader(event, 'retry-after', Math.ceil(retryAfterMs / 1000))
    throw new ApiError('rate_limited')
  }

  // Refus immédiat quand la taille annoncée suffit à conclure : pas un
  // octet du corps n'est lu. Sinon, le flux sera coupé à la limite.
  const announced = Number(getRequestHeader(event, 'content-length'))

  if (announced > SOUND_FILE_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
    // Le client est encore en train d'envoyer : on ferme après la réponse.
    setResponseHeader(event, 'connection', 'close')
    throw new ApiError('file_too_large')
  }

  const storage = createMediaStorage(resolveDataDir())
  let upload

  try {
    upload = await readSoundUpload(event.node.req, storage, SOUND_FILE_MAX_BYTES)
  }
  catch (error) {
    setResponseHeader(event, 'connection', 'close')
    throw error
  }

  if (!upload.file) {
    throw new ApiError('validation_failed', { issues: [{ path: FILE_FIELD, code: 'required' }] })
  }

  const sound = await createSound(useDatabase(), storage, {
    file: upload.file,
    originalFilename: upload.originalFilename,
    fields: upload.fields,
    createdBy: user.id,
  })

  setResponseStatus(event, 201)

  return sound
})
