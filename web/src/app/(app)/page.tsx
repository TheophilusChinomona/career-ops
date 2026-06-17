import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listJobs } from '@/services/jobs'
import DashboardView from '@/components/DashboardView'

export default async function DashboardPage() {
  // Next 16: headers() is async
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  const jobs = await listJobs(session.user.id)

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">Dashboard</h1>
      <DashboardView jobs={jobs} />
    </div>
  )
}
