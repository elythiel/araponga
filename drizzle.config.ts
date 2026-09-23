import { defineConfig } from 'drizzle-kit'
import { databaseFile } from './server/database/client'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: databaseFile(process.env.DATA_DIR ?? './data'),
  },
})
