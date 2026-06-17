import Link from 'next/link'
import type { Job } from '@/generated/prisma'
import JobCard from './JobCard'

type JobRow = Pick<
  Job,
  'id' | 'company' | 'role' | 'location' | 'status' | 'score'
>

type Props = {
  jobs: JobRow[]
}

export default function DashboardView({ jobs }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-neutral-500 text-sm">No jobs in your pipeline yet.</p>
        <Link
          href="/find"
          className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Find Jobs
        </Link>
      </div>
    )
  }

  // Stats
  const totalJobs = jobs.length
  const scoredJobs = jobs.filter((j) => j.score !== null && j.score !== undefined)
  const avgScore =
    scoredJobs.length > 0
      ? scoredJobs.reduce((sum, j) => sum + (j.score ?? 0), 0) / scoredJobs.length
      : null
  const topScore =
    scoredJobs.length > 0 ? Math.max(...scoredJobs.map((j) => j.score ?? 0)) : null

  // Count by status
  const statusCounts: Record<string, number> = {}
  for (const job of jobs) {
    const s = job.status ?? 'Unknown'
    statusCounts[s] = (statusCounts[s] ?? 0) + 1
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats strip */}
      <div data-testid="stats-strip" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total Jobs</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {totalJobs}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Avg Score</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {avgScore !== null ? avgScore.toFixed(1) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Top Score</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {topScore !== null ? topScore.toFixed(1) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">By Status</p>
          <div className="flex flex-col gap-0.5">
            {Object.entries(statusCounts).map(([status, count]) => (
              <p
                key={status}
                data-testid={`stat-status-${status}`}
                className="text-xs text-neutral-700 dark:text-neutral-300"
              >
                <span className="font-semibold">{count}</span> {status}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Job list */}
      <div className="flex flex-col gap-3">
        {jobs.map((job) => (
          <Link key={job.id} href={`/jobs/${job.id}`} className="block">
            <JobCard job={job} />
          </Link>
        ))}
      </div>
    </div>
  )
}
