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

  // Top opportunities: best-scored first (unscored last), capped — a dashboard
  // summarizes; the full pipeline lives in My Jobs.
  const topOpportunities = [...jobs]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 6)

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

      {/* Top opportunities — highest-scored, not the whole pipeline */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Top opportunities
          </h2>
          <Link
            href="/jobs"
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            View all {totalJobs} jobs →
          </Link>
        </div>

        {topOpportunities.length > 0 ? (
          <div className="flex flex-col gap-3">
            {topOpportunities.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="block">
                <JobCard job={job} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            No evaluated jobs yet. Open a job and run <span className="font-medium text-neutral-700 dark:text-neutral-300">Evaluate</span> to surface your best matches here.
          </p>
        )}
      </section>
    </div>
  )
}
