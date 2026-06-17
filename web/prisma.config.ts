import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // DATABASE_URL is passed at runtime via the adapter in src/lib/db.ts.
  // For migrate/studio commands that need a direct connection, set DATABASE_URL
  // in your .env.local before running them.
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
