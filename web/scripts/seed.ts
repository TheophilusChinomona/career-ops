/**
 * One-off seed script — reads config/profile.yml and cv.md from the repo root,
 * parses them, and upserts Profile + CvMaster for a given user.
 *
 * Usage:
 *   npx tsx web/scripts/seed.ts <userId>
 *
 * Requires a live DATABASE_URL environment variable pointing to a running
 * Postgres instance with the schema already migrated.
 */
import { seedFromRepo } from '../src/services/importer'

const userId = process.argv[2]
if (!userId) {
  console.error('Usage: npx tsx web/scripts/seed.ts <userId>')
  process.exit(1)
}

console.log(`Seeding profile + CV for user: ${userId}`)
seedFromRepo(userId)
  .then(() => {
    console.log('Seed complete.')
    process.exit(0)
  })
  .catch((err: unknown) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
