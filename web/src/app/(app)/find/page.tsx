'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Job } from '@/generated/prisma'

type JobResult = Pick<Job, 'id' | 'company' | 'role' | 'location' | 'status' | 'score'>

export default function FindPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<JobResult[] | null>(null)
  const [added, setAdded] = useState<number | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResults(null)
    setAdded(null)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      const data = await res.json() as { added?: number; jobs?: JobResult[]; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Search failed')
        return
      }

      setAdded(data.added ?? 0)
      setResults(data.jobs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Find Jobs</h1>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for jobs (e.g. Senior Frontend Engineer)"
          className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {results !== null && (
        <div className="flex flex-col gap-3">
          {added !== null && added > 0 && (
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              {added} added to pipeline
            </p>
          )}
          {added === 0 && (
            <p className="text-sm text-neutral-500">No new jobs added (all already in pipeline).</p>
          )}

          {results.length === 0 ? (
            <p className="text-sm text-neutral-500">No results found.</p>
          ) : (
            results.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                      {job.company}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{job.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {job.status}
                    </span>
                    {job.score !== null && job.score !== undefined && (
                      <span className="text-xs text-neutral-500">{job.score.toFixed(1)}/5</span>
                    )}
                  </div>
                </div>
                {job.location && (
                  <p className="text-xs text-neutral-500 mt-1">{job.location}</p>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
