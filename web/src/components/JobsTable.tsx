'use client'

import Link from 'next/link'
import type { Job } from '@/generated/prisma'
import ScoreBadge from './ScoreBadge'

type Props = {
  jobs: Pick<Job, 'id' | 'company' | 'role' | 'location' | 'status' | 'score' | 'createdAt'>[]
}

export default function JobsTable({ jobs }: Props) {
  if (jobs.length === 0) {
    return (
      <p className="text-sm text-neutral-500 py-8 text-center">
        No jobs yet.{' '}
        <Link href="/find" className="underline text-neutral-700 dark:text-neutral-300">
          Find Jobs
        </Link>
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
          <tr>
            <th className="px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Company</th>
            <th className="px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Role</th>
            <th className="px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Location</th>
            <th className="px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Score</th>
            <th className="px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/jobs/${job.id}`}
                  className="font-medium text-neutral-900 dark:text-neutral-100 hover:underline"
                >
                  {job.company}
                </Link>
              </td>
              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{job.role}</td>
              <td className="px-4 py-3 text-neutral-500">{job.location ?? '—'}</td>
              <td className="px-4 py-3">
                {job.score !== null && job.score !== undefined ? (
                  <ScoreBadge score={job.score} />
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {job.status ?? 'New'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
