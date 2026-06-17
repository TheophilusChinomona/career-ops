import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { db } from './db'
import { env } from './env'

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Single-user guard: block sign-up once one user exists.
  // Returns false to abort creation; throws are not the documented API —
  // the before hook must return boolean | void | { data: ... }.
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const count = await db.user.count()
          if (count >= 1) return false
        },
      },
    },
  },
})
