// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { detectAudioType } from '../../../server/utils/file-type'
import { HEADERS } from './audio-fixtures'

describe('detectAudioType', () => {
  it.each([
    ['un MP3 avec étiquette ID3', HEADERS.mp3Id3, 'mp3', 'audio/mpeg'],
    ['un MP3 commençant par une trame', HEADERS.mp3Frame, 'mp3', 'audio/mpeg'],
    ['un Ogg', HEADERS.ogg, 'ogg', 'audio/ogg'],
    ['un WAV', HEADERS.wav, 'wav', 'audio/wav'],
    ['un M4A', HEADERS.m4a, 'm4a', 'audio/mp4'],
    ['un WebM', HEADERS.webm, 'webm', 'audio/webm'],
  ])('reconnaît %s', (_, header, extension, mimeType) => {
    expect(detectAudioType(header)).toStrictEqual({ extension, mimeType })
  })

  it.each([
    ['un ZIP', HEADERS.zip],
    ['un PNG', HEADERS.png],
    ['une image HEIC, pourtant en conteneur ISO BMFF', HEADERS.heic],
    ['un Matroska, pourtant en conteneur EBML', HEADERS.matroska],
    ['de l\'AAC brut, qui partage la synchro MPEG', HEADERS.aacAdts],
    ['du texte', HEADERS.text],
    ['un fichier vide', HEADERS.empty],
  ])('refuse %s', (_, header) => {
    expect(detectAudioType(header)).toBeNull()
  })

  it('ne se fie qu\'aux octets : un en-tête tronqué n\'est pas reconnu', () => {
    expect(detectAudioType(HEADERS.wav.subarray(0, 10))).toBeNull()
  })
})
