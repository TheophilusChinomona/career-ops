'use client'

import { useState } from 'react'
import type { Job, Document } from '@/generated/prisma'

type Props = {
  job: Job
  documents: Document[]
}

export default function ApplyPanel({ job, documents }: Props) {
  const [loading, setLoading] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cvDocs = documents.filter((d) => d.type === 'cv')
  const coverDocs = documents.filter((d) => d.type === 'cover')

  async function handleMarkApplied() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Applied' }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Failed to mark as applied')
        return
      }
      setApplied(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const postingHref = job.applyUrl ?? job.url

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
        Apply
      </h2>

      {/* Open posting link */}
      {postingHref && (
        <div>
          <a
            href={postingHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open posting ↗
          </a>
        </div>
      )}

      {/* CV downloads */}
      {cvDocs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Tailored CV</p>
          {cvDocs.map((doc) => (
            <a
              key={doc.id}
              href={`/api/documents/${doc.id}/pdf`}
              download
              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {doc.label}
            </a>
          ))}
        </div>
      )}

      {/* Cover letter downloads */}
      {coverDocs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Cover Letter</p>
          {coverDocs.map((doc) => (
            <a
              key={doc.id}
              href={`/api/documents/${doc.id}/pdf`}
              download
              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {doc.label}
            </a>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {applied ? (
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
          Marked as Applied!
        </p>
      ) : (
        <button
          type="button"
          onClick={handleMarkApplied}
          disabled={loading}
          className="rounded px-4 py-2 text-sm font-medium bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Updating…' : 'Mark applied'}
        </button>
      )}
    </div>
  )
}
