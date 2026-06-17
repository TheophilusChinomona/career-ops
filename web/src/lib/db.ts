// Prisma 7 requires a driver adapter — no URL in schema.prisma.
// Install `@prisma/adapter-pg` and `pg` then run: npm install @prisma/adapter-pg pg
// The generated client lives at src/generated/prisma (set in prisma.config.ts).
import { PrismaClient } from '../generated/prisma'
import type { PrismaClientOptions } from '../generated/prisma/runtime/client'

type PrismaGlobal = { prisma?: PrismaClient }
const g = globalThis as unknown as PrismaGlobal

function createClient(): PrismaClient {
  // Dynamically require the adapter so the module can be imported in test
  // environments where @prisma/adapter-pg is not yet installed (the live-DB
  // test is BLOCKED until the package is available).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg')
  const connectionString = process.env.DATABASE_URL!
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter } as PrismaClientOptions)
}

export const db: PrismaClient = g.prisma ?? createClient()
if (process.env.NODE_ENV !== 'production') g.prisma = db
