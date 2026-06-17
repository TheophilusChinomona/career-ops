'use client'

import { useState } from 'react'
import type { Job, Evaluation, Document } from '@/generated/prisma'
import type { EvaluationOut } from '@/llm/schemas'
import ScoreBadge from './ScoreBadge'
import EvaluationView from './EvaluationView'
import ActionBar from './ActionBar'
import ApplyPanel from './ApplyPanel'

const JOB_STATUSES = [
  'New',
  'Evaluated',
  'Applied',
  'Responded',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
  'SKIP',
] as const

type Props = {
  job: Job
  evaluation: Evaluation | null
  documents: Document[]
}

type Tab = 'jd' | 'evaluation' | 'documents'

function blocksFromEvaluation(evaluation: Evaluation): EvaluationOut['blocks'] {
  const raw = evaluation.blocks as Record<string, string>
  return {
    A: raw.A ?? '',
    B: raw.B ?? '',
    C: raw.C ?? '',
    D: raw.D ?? '',
    E: raw.E ?? '',
    F: raw.F ?? '',
    G: raw.G ?? '',
  }
}

export default function JobDetailView({ job, evaluation: initialEvaluation, documents: initialDocuments }: Props) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(initialEvaluation)
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [status, setStatus] = useState<string>(job.status ?? 'New')
  const [activeTab, setActiveTab] = useState<Tab>('jd')
  const [loadingEvaluate, setLoadingEvaluate] = useState(false)
  const [loadingCv, setLoadingCv] = useState(false)
  const [loadingCover, setLoadingCover] = useState(false)
  const [showApplyPanel, setShowApplyPanel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawJD, setRawJD] = useState<string | null>(job.rawJD ?? null)
  const [loadingJd, setLoadingJd] = useState(false)

  async function handleFetchJd() {
    setLoadingJd(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${job.id}/fetch-jd`, { method: 'POST' })
      const data = (await res.json()) as { rawJD?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not fetch the job description')
        return
      }
      setRawJD(data.rawJD ?? '')
    } catch {
      setError('Network error fetching the description')
    } finally {
      setLoadingJd(false)
    }
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    setStatus(newStatus)
    try {
      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Failed to update status')
      }
    } catch {
      setError('Network error updating status')
    }
  }

  async function handleEvaluate() {
    setLoadingEvaluate(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${job.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Evaluation failed')
        return
      }
      const evalRow = await res.json() as Evaluation
      setEvaluation(evalRow)
      setActiveTab('evaluation')
    } catch {
      setError('Network error during evaluation')
    } finally {
      setLoadingEvaluate(false)
    }
  }

  async function handleGenerate(type: 'cv' | 'cover') {
    if (type === 'cv') setLoadingCv(true)
    else setLoadingCover(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${job.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Generation failed')
        return
      }
      const { documentId } = await res.json() as { documentId: string; pdfUrl: string }
      // Re-fetch documents list by appending the new document to state
      // We create a minimal placeholder and the page refresh can update it
      const label = type === 'cv' ? `CV — ${job.company}` : `Cover Letter — ${job.company}`
      const newDoc: Document = {
        id: documentId,
        userId: job.userId,
        jobId: job.id,
        type,
        label,
        html: '',
        pdfPath: '',
        createdAt: new Date(),
      }
      setDocuments((prev) => [...prev, newDoc])
      setActiveTab('documents')
    } catch {
      setError('Network error during generation')
    } finally {
      if (type === 'cv') setLoadingCv(false)
      else setLoadingCover(false)
    }
  }

  const evaluationForView: EvaluationOut | null = evaluation
    ? {
        score: evaluation.score,
        legitimacy: evaluation.legitimacy as EvaluationOut['legitimacy'],
        recommendApply: evaluation.recommendApply,
        blocks: blocksFromEvaluation(evaluation),
        notes: evaluation.notes ?? undefined,
      }
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{job.company}</h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">{job.role}</p>
            {job.location && (
              <p className="text-sm text-neutral-500 mt-1">{job.location}</p>
            )}
            {evaluation && (
              <p className="text-sm text-neutral-500 mt-1">
                Legitimacy: {evaluation.legitimacy}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {job.score !== null && job.score !== undefined && (
              <ScoreBadge score={job.score} />
            )}
            <div className="flex items-center gap-2">
              <label
                htmlFor="job-status-select"
                className="text-sm text-neutral-500 sr-only"
              >
                Status
              </label>
              {/* Visible label for screen readers and tests */}
              <span className="text-sm text-neutral-500" aria-hidden="true">Status</span>
              <select
                id="job-status-select"
                aria-label="Status"
                value={status}
                onChange={handleStatusChange}
                className="text-sm border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <ActionBar
        onEvaluate={handleEvaluate}
        onTailorCv={() => handleGenerate('cv')}
        onCoverLetter={() => handleGenerate('cover')}
        onApply={() => setShowApplyPanel((v) => !v)}
      />

      {/* Loading indicators */}
      {(loadingEvaluate || loadingCv || loadingCover) && (
        <p className="text-sm text-neutral-500 animate-pulse">
          {loadingEvaluate && 'Evaluating…'}
          {loadingCv && 'Generating CV…'}
          {loadingCover && 'Generating cover letter…'}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Apply panel (revealed when Apply clicked) */}
      {showApplyPanel && (
        <ApplyPanel job={job} documents={documents} />
      )}

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800 mb-4">
          {(['jd', 'evaluation', 'documents'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
                activeTab === tab
                  ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
              ].join(' ')}
            >
              {tab === 'jd' ? 'Job Description' : tab === 'evaluation' ? 'Evaluation' : 'Documents'}
            </button>
          ))}
        </div>

        {activeTab === 'jd' && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {rawJD ? (
              <pre className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed bg-white dark:bg-neutral-950 rounded border border-neutral-200 dark:border-neutral-800 p-4">
                {rawJD}
              </pre>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded border border-dashed border-neutral-300 dark:border-neutral-700 p-6">
                <p className="text-sm text-neutral-500">
                  The description hasn’t been fetched yet. Pull it from the posting, or run Evaluate (which fetches it automatically).
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFetchJd}
                    disabled={loadingJd || !job.url}
                    className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {loadingJd ? 'Fetching…' : 'Fetch description'}
                  </button>
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    >
                      Open posting →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'evaluation' && (
          <div>
            {evaluationForView ? (
              <EvaluationView evaluation={evaluationForView} />
            ) : (
              <p className="text-sm text-neutral-500">
                No evaluation yet. Click <strong>Evaluate</strong> to run one.
              </p>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No documents yet. Use <strong>Tailor CV</strong> or <strong>Cover Letter</strong> to generate.
              </p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded border border-neutral-200 dark:border-neutral-800 px-4 py-3 bg-white dark:bg-neutral-950"
                >
                  <a
                    href={`/api/documents/${doc.id}/pdf`}
                    download
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {doc.label}
                  </a>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
