// Prisma 7 requires a driver adapter — there is no `url` in schema.prisma.
// The generated client lives at src/generated/prisma (set in prisma.config.ts).
import { PrismaClient } from '../generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

type PrismaGlobal = { prisma?: PrismaClient }
const g = globalThis as unknown as PrismaGlobal

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const db: PrismaClient = g.prisma ?? createClient()
if (process.env.NODE_ENV !== 'production') g.prisma = db
