import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listJobs } from '@/services/jobs'
import JobsTable from '@/components/JobsTable'

export default async function MyJobsPage() {
  // Next 16: headers() is async
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  const jobs = await listJobs(session.user.id)

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">My Jobs</h1>
      <JobsTable jobs={jobs} />
    </div>
  )
}
