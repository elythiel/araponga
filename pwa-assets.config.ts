import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Icônes de passe 1, tirées d'un SVG neutre : le J11 les remplace.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
})
