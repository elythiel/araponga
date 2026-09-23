// @vitest-environment node
import { createApp, createError, eventHandler, toWebHandler } from 'h3'
import type { EventHandler } from 'h3'
import { describe, expect, it } from 'vitest'
import apiErrorHandler from '../../../server/error'
import { parseBody, parseQuery } from '../../../server/utils/validation'
import { SoundQuerySchema, SoundUpdateSchema } from '../../../shared/schemas/sound'

/**
 * Application h3 branchée sur le gestionnaire d'erreurs de l'API, comme Nitro
 * le fait : la requête traverse la vraie pile jusqu'à la réponse HTTP.
 */
function serve(handler: EventHandler) {
  const app = createApp({
    onError: (error, event) => apiErrorHandler(error, event, {
      defaultHandler: () => {
        throw new Error('Le gestionnaire de Nitro n\'est pas branché dans ce test.')
      },
    }),
  })

  app.use(handler)

  const fetch = toWebHandler(app)

  return (path: string, init?: RequestInit) => fetch(new Request(new URL(path, 'http://localhost'), init))
}

const updateSound = serve(eventHandler(event => parseBody(event, SoundUpdateSchema)))
const listSounds = serve(eventHandler(event => parseQuery(event, SoundQuerySchema)))

function patch(body: string, headers: Record<string, string> = {}) {
  return updateSound('/', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

describe('réponse 422 d\'une erreur de validation', () => {
  it('suit le format de docs/03-api.md', async () => {
    const response = await patch(JSON.stringify({ name: 'a'.repeat(81) }))

    expect(response.status).toBe(422)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toStrictEqual({
      statusCode: 422,
      code: 'validation_failed',
      message: 'Le formulaire contient des erreurs.',
      issues: [{ path: 'name', code: 'too_long', max: 80 }],
    })
  })

  it('traduit le message selon Accept-Language, jamais les codes', async () => {
    const response = await patch(JSON.stringify({ name: '' }), { 'accept-language': 'en-US,en;q=0.9' })

    expect(await response.json()).toMatchObject({
      code: 'validation_failed',
      message: 'The form contains errors.',
      issues: [{ path: 'name', code: 'required' }],
    })
  })

  it('désigne chaque champ en faute', async () => {
    const response = await patch(JSON.stringify({ name: '', tags: 'Blagues', hotkey: 'F13' }))

    expect((await response.json()).issues).toEqual([
      { path: 'name', code: 'required' },
      { path: 'tags', code: 'invalid_type' },
      { path: 'hotkey', code: 'invalid_value' },
    ])
  })

  it('valide aussi la query string', async () => {
    const response = await listSounds('/?tags=blagues&tags=Jeux')

    expect(response.status).toBe(422)
    expect((await response.json()).issues).toEqual([{ path: 'tags.1', code: 'invalid_format' }])
  })
})

describe('entrée valide', () => {
  it('transmet au handler la sortie normalisée du corps', async () => {
    const response = await patch(JSON.stringify({ name: ' Tada ', hotkey: 'T' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toStrictEqual({ name: 'Tada', hotkey: 't' })
  })

  it('transmet au handler la sortie normalisée de la query string', async () => {
    const response = await listSounds('/?q=%20tada%20&tags=blagues&tags=jeux-video')

    expect(await response.json()).toEqual({ q: 'tada', tags: ['blagues', 'jeux-video'] })
  })
})

describe('autres erreurs', () => {
  it('un corps JSON illisible donne une 400 bad_request', async () => {
    const response = await patch('{"name":')

    expect(response.status).toBe(400)
    expect(await response.json()).toStrictEqual({
      statusCode: 400,
      code: 'bad_request',
      message: 'La requête est mal formée.',
    })
  })

  it('une erreur qui n\'est pas une ApiError est laissée aux gestionnaires suivants', async () => {
    const fail = serve(eventHandler(() => {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }))

    const response = await fail('/')

    expect(response.status).toBe(404)
    expect(await response.json()).not.toHaveProperty('code')
  })
})
