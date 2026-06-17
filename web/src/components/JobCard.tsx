import type { Job } from '@/generated/prisma'
import ScoreBadge from './ScoreBadge'

type JobCardProps = {
  job: Pick<Job, 'id' | 'company' | 'role' | 'location' | 'status' | 'score'>
}

export default function JobCard({ job }: JobCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
            {job.company}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{job.role}</p>
        </div>
        {job.score !== null && job.score !== undefined && (
          <ScoreBadge score={job.score} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
          {job.status}
        </span>
        {job.location && (
          <span className="text-xs text-neutral-500">{job.location}</span>
        )}
      </div>
    </div>
  )
}
