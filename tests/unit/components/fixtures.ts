import type { AdminSound } from '../../../shared/catalog'

export function anAdminSound(overrides: Partial<AdminSound> = {}): AdminSound {
  const id = overrides.id ?? crypto.randomUUID()

  return {
    id,
    name: 'Tada',
    description: null,
    url: `/media/${'a'.repeat(64)}.mp3`,
    mimeType: 'audio/mpeg',
    durationMs: 1500,
    hotkey: null,
    position: 1000,
    tags: [],
    sizeBytes: 120_000,
    originalFilename: 'tada.mp3',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    createdBy: null,
    ...overrides,
  }
}

/**
 * Les tests lisent les libellés français. happy-dom annonce un navigateur
 * anglais, que la détection de langue suivrait sinon.
 */
export async function useFrench(): Promise<void> {
  await useNuxtApp().$i18n.setLocale('fr')
}
