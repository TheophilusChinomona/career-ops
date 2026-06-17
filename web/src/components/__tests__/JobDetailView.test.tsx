import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import JobDetailView from '../JobDetailView'
import type { Job, Evaluation, Document } from '@/generated/prisma'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/jobs/job-1',
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const mockJob: Job = {
  id: 'job-1',
  userId: 'user-1',
  company: 'Acme Corp',
  role: 'Software Engineer',
  location: 'Remote',
  url: 'https://acme.com/jobs/1',
  applyUrl: 'https://acme.com/apply/1',
  source: 'firecrawl',
  rawJD: 'This is the job description for testing.',
  postedAt: null,
  status: 'New',
  score: 4.2,
  archetype: null,
  createdAt: new Date('2026-06-01'),
}

const mockEvaluation: Evaluation = {
  id: 'eval-1',
  jobId: 'job-1',
  score: 4.2,
  blocks: {
    A: 'Block A text',
    B: 'Block B text',
    C: 'Block C text',
    D: 'Block D text',
    E: 'Block E text',
    F: 'Block F text',
    G: 'Block G text',
  },
  legitimacy: 'High Confidence',
  recommendApply: true,
  notes: null,
  createdAt: new Date('2026-06-02'),
}

const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    userId: 'user-1',
    jobId: 'job-1',
    type: 'cv',
    label: 'CV — Acme Corp',
    html: '<p>CV HTML</p>',
    pdfPath: '/storage/pdfs/doc-1.pdf',
    createdAt: new Date('2026-06-03'),
  },
]

describe('JobDetailView', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('renders job header info', () => {
    render(
      <JobDetailView job={mockJob} evaluation={null} documents={[]} />
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
  })

  it('renders status select with current status', () => {
    render(
      <JobDetailView job={mockJob} evaluation={null} documents={[]} />
    )
    const select = screen.getByRole('combobox', { name: /status/i })
    expect(select).toBeInTheDocument()
    expect((select as HTMLSelectElement).value).toBe('New')
  })

  it('clicking Evaluate calls the evaluate endpoint and renders returned blocks', async () => {
    const evaluateResponse = {
      id: 'eval-2',
      jobId: 'job-1',
      score: 3.8,
      blocks: {
        A: 'Returned Block A',
        B: 'Returned Block B',
        C: 'Returned Block C',
        D: 'Returned Block D',
        E: 'Returned Block E',
        F: 'Returned Block F',
        G: 'Returned Block G',
      },
      legitimacy: 'Proceed with Caution',
      recommendApply: false,
      notes: null,
      createdAt: new Date().toISOString(),
    }

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(evaluateResponse), { status: 200 })
    )

    render(
      <JobDetailView job={mockJob} evaluation={null} documents={[]} />
    )

    fireEvent.click(screen.getByRole('button', { name: /evaluate/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/jobs/job-1/evaluate',
        expect.objectContaining({ method: 'POST' })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Returned Block A')).toBeInTheDocument()
    })
  })

  it('changing status select calls the status endpoint with the chosen status', async () => {
    const updatedJob = { ...mockJob, status: 'Applied' }
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(updatedJob), { status: 200 })
    )

    render(
      <JobDetailView job={mockJob} evaluation={null} documents={[]} />
    )

    const select = screen.getByRole('combobox', { name: /status/i })
    fireEvent.change(select, { target: { value: 'Applied' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/jobs/job-1/status',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ status: 'Applied' }),
        })
      )
    })
  })

  it('renders existing evaluation blocks when evaluation prop provided (evaluation tab)', () => {
    render(
      <JobDetailView job={mockJob} evaluation={mockEvaluation} documents={[]} />
    )
    // Switch to the Evaluation tab
    fireEvent.click(screen.getByRole('button', { name: /^Evaluation$/i }))
    expect(screen.getByText('Block A text')).toBeInTheDocument()
    expect(screen.getByText('Block G text')).toBeInTheDocument()
  })

  it('renders documents download links (documents tab)', () => {
    render(
      <JobDetailView job={mockJob} evaluation={null} documents={mockDocuments} />
    )
    // Switch to the Documents tab
    fireEvent.click(screen.getByRole('button', { name: /^Documents$/i }))
    const link = screen.getByRole('link', { name: /CV — Acme Corp/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/api/documents/doc-1/pdf')
  })
})
