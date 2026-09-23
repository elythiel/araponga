import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SoundUploadForm from '~/components/admin/SoundUploadForm.vue'
import type { AdminSound } from '../../../shared/catalog'
import { anAdminSound, useFrench } from './fixtures'

const existing = anAdminSound({ name: 'Rimshot', hotkey: 'a' })

/** Erreur telle que `$fetch` la lève : le corps de la réponse est dans `data`. */
function apiError(data: Record<string, unknown>) {
  return Object.assign(new Error('FetchError'), { data })
}

async function mountForm(upload: (form: FormData) => Promise<AdminSound>) {
  const wrapper = await mountSuspended(SoundUploadForm, {
    props: { sounds: [existing], upload },
    attachTo: document.body,
  })

  return wrapper
}

async function chooseFile(wrapper: Awaited<ReturnType<typeof mountForm>>, name = 'tada.mp3') {
  const input = wrapper.find<HTMLInputElement>('input[type="file"]')

  Object.defineProperty(input.element, 'files', { value: [new File(['ID3'], name, { type: 'audio/mpeg' })] })
  await input.trigger('change')
}

describe('formulaire d\'ajout', () => {
  beforeEach(async () => {
    await useFrench()
    // Le `URL` de Node ne connaît pas les `File` de happy-dom.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:apercu')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('préremplit le nom depuis le fichier, sans extension', async () => {
    const wrapper = await mountForm(vi.fn())

    await chooseFile(wrapper, 'Grand Tada.mp3')

    expect(wrapper.find<HTMLInputElement>('#upload-name').element.value).toBe('Grand Tada')
  })

  it('refuse d\'envoyer sans fichier, et le dit sur le champ', async () => {
    const upload = vi.fn()
    const wrapper = await mountForm(upload)

    await wrapper.find('form').trigger('submit')

    expect(upload).not.toHaveBeenCalled()
    expect(wrapper.find('#upload-file').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('#upload-file-error').text()).toBe('Ce champ est obligatoire.')
  })

  it('envoie les champs texte puis le fichier', async () => {
    const upload = vi.fn(async (_form: FormData) => anAdminSound({ name: 'Tada' }))
    const wrapper = await mountForm(upload)

    await chooseFile(wrapper)
    await wrapper.find('#upload-tags').setValue('Blagues, Cinéma')
    await wrapper.find('#upload-hotkey').setValue('t')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-upload-status]').text()).toBe('« Tada » a été ajouté.'))

    const form = upload.mock.calls[0]![0]

    expect([...form.keys()]).toEqual(['name', 'description', 'tags', 'hotkey', 'file'])
    expect(form.get('tags')).toBe('["Blagues","Cinéma"]')
  })

  it('affiche un raccourci déjà pris sur le champ raccourci, en nommant le son qui le porte', async () => {
    const wrapper = await mountForm(vi.fn().mockRejectedValue(
      apiError({ statusCode: 409, code: 'hotkey_taken', details: { soundId: existing.id } }),
    ))

    await chooseFile(wrapper)
    await wrapper.find('#upload-hotkey').setValue('a')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('#upload-hotkey-error').exists()).toBe(true))

    expect(wrapper.find('#upload-hotkey-error').text()).toBe('Ce raccourci est déjà assigné à « Rimshot ».')
    expect(wrapper.find('#upload-hotkey').attributes('aria-describedby')).toContain('upload-hotkey-error')
    expect(document.activeElement?.id).toBe('upload-hotkey')
  })

  it('lie un doublon au son existant', async () => {
    const wrapper = await mountForm(vi.fn().mockRejectedValue(
      apiError({ statusCode: 409, code: 'duplicate_sound', details: { soundId: existing.id } }),
    ))

    await chooseFile(wrapper)
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('#upload-file-error a').exists()).toBe(true))

    expect(wrapper.find('#upload-file-error a').attributes('href')).toBe(`#sound-${existing.id}`)
    expect(wrapper.find('#upload-file-error a').text()).toBe('Voir « Rimshot »')
  })

  it('rattache les erreurs de validation du serveur à leurs champs', async () => {
    const wrapper = await mountForm(vi.fn().mockRejectedValue(apiError({
      statusCode: 422,
      code: 'validation_failed',
      issues: [{ path: 'tags.1', code: 'too_long', max: 32 }],
    })))

    await chooseFile(wrapper)
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('#upload-tags-error').exists()).toBe(true))

    expect(wrapper.find('#upload-tags-error').text()).toBe('32 caractères au maximum.')
  })
})
