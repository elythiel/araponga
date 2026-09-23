// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['.output', '.nuxt', 'coverage', 'playwright-report', 'test-results'],
})
