/// <reference types="vitest" />
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    root: 'src/',
    setupFiles: ['../config/vitest.setup.js'],
  },
})
