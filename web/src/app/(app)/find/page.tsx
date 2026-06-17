'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Job } from '@/generated/prisma'

type JobResult = Pick<Job, 'id' | 'company' | 'role' | 'location' | 'status' | 'score'>

export default function FindPage() {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<JobResult[] | null>(null)
  const [added, setAdded] = useState<number | null>(null)
  const [scanInfo, setScanInfo] = useState<{ scanned: number; added: number } | null>(null)

  // Add by URL state
  const [jobUrl, setJobUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlSuccess, setUrlSuccess] = useState<{ jobId: string; created: boolean } | null>(null)

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

  async function handleScan() {
    setScanning(true)
    setError(null)
    setScanInfo(null)

    try {
      const res = await fetch('/api/scan', { method: 'POST' })
      const data = await res.json() as { scanned?: number; found?: number; added?: number; jobs?: JobResult[]; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Scan failed')
        return
      }

      setAdded(data.added ?? 0)
      setResults(data.jobs ?? [])
      setScanInfo({ scanned: data.scanned ?? 0, added: data.added ?? 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  async function handleAddByUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!jobUrl.trim()) return

    setUrlLoading(true)
    setUrlError(null)
    setUrlSuccess(null)

    try {
      const res = await fetch('/api/jobs/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl.trim() }),
      })

      const data = await res.json() as { jobId?: string; created?: boolean; error?: string }

      if (!res.ok) {
        setUrlError(data.error ?? 'Failed to add job')
        return
      }

      if (data.jobId) {
        setUrlSuccess({ jobId: data.jobId, created: data.created ?? true })
        // Navigate to the new job detail page on success
        router.push(`/jobs/${data.jobId}`)
      }
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to add job')
    } finally {
      setUrlLoading(false)
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
        <button
          type="button"
          onClick={handleScan}
          disabled={loading || scanning}
          className="rounded-lg bg-neutral-700 dark:bg-neutral-200 text-white dark:text-neutral-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {scanning ? 'Scanning…' : 'Scan boards'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Add by URL section */}
      <section aria-labelledby="add-by-url-heading" className="flex flex-col gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-4">
        <h2 id="add-by-url-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Add by URL
        </h2>
        <p className="text-xs text-neutral-500">
          Paste any individual job posting URL (Indeed, LinkedIn, company careers page, etc.)
        </p>
        <form onSubmit={handleAddByUrl} className="flex gap-2">
          <label htmlFor="job-url" className="sr-only">Job posting URL</label>
          <input
            id="job-url"
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://company.com/jobs/123"
            className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
            disabled={urlLoading}
          />
          <button
            type="submit"
            disabled={urlLoading || !jobUrl.trim()}
            className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {urlLoading ? 'Adding…' : 'Add'}
          </button>
        </form>

        {urlError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{urlError}</p>
        )}

        {urlSuccess && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Job {urlSuccess.created ? 'added' : 'already in pipeline'}.{' '}
            <Link
              href={`/jobs/${urlSuccess.jobId}`}
              className="font-medium underline hover:text-green-900 dark:hover:text-green-300"
            >
              View job
            </Link>
          </p>
        )}
      </section>

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
          {scanInfo && (
            <p className="text-sm text-neutral-500">
              Scanned {scanInfo.scanned} companies, added {scanInfo.added}
            </p>
          )}

          {results.length === 0 ? (
            <p className="text-sm text-neutral-500">No results found.</p>
          ) : (
            results.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                      {job.company}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{job.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                      aria-label="Added to pipeline"
                    >
                      Added to pipeline
                    </span>
                    {job.score !== null && job.score !== undefined && (
                      <span className="text-xs text-neutral-500">{job.score.toFixed(1)}/5</span>
                    )}
                  </div>
                </div>
                {job.location && (
                  <p className="text-xs text-neutral-500 mt-1">{job.location}</p>
                )}
                <div className="mt-2">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-xs font-medium text-neutral-700 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    Evaluate now
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
