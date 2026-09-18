import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Mirrors tsconfig.json's baseUrl ("./src") + "@/*" -> "./*" path alias so
// unit tests can import app code (@/lib/..., @/types/...) the same way the
// app itself does.
const srcDir = path.resolve(process.cwd(), 'src')

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: srcDir }],
  },
  // tsconfig keeps `jsx: preserve` for Next's own compiler; component tests
  // (server-rendered to static markup) need JSX actually transformed.
  esbuild: { jsx: 'automatic' },
})
