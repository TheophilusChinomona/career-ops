import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import ProfileForm from '@/components/ProfileForm'
export default async function ProfilePage() {
  // Next 16: headers() is async
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  const userId = session.user.id

  const [profile, cvMaster] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.cvMaster.findUnique({ where: { userId } }),
  ])

  // Coerce Json fields (opaque Prisma JsonValue) to typed arrays for the client component.
  // Double cast via unknown to satisfy strict TypeScript without losing the actual runtime values.
  const cvMasterForForm = cvMaster
    ? {
        ...cvMaster,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        experience: (cvMaster.experience as unknown as any[]) ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        education: (cvMaster.education as unknown as any[]) ?? [],
        certs: (cvMaster.certs as unknown as string[]) ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        skills: (cvMaster.skills as unknown as any[]) ?? [],
      }
    : null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Profile &amp; CV
        </h1>
        {!profile && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No profile yet — fill in the form or seed from your repo files.
          </p>
        )}
      </div>
      <ProfileForm initialProfile={profile} initialCvMaster={cvMasterForForm} />
    </div>
  )
}
