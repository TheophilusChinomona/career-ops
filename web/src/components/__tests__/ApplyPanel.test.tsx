import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ApplyPanel from '../ApplyPanel'
import type { Job, Document } from '@/generated/prisma'

// Mock next/navigation (in case any child needs it)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/jobs/job-1',
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
  rawJD: null,
  postedAt: null,
  status: 'Evaluated',
  score: 4.2,
  archetype: null,
  createdAt: new Date('2026-06-01'),
}

const mockDocuments: Document[] = [
  {
    id: 'doc-cv-1',
    userId: 'user-1',
    jobId: 'job-1',
    type: 'cv',
    label: 'CV — Acme Corp',
    html: '<p>CV</p>',
    pdfPath: '/storage/pdfs/doc-cv-1.pdf',
    createdAt: new Date('2026-06-02'),
  },
  {
    id: 'doc-cover-1',
    userId: 'user-1',
    jobId: 'job-1',
    type: 'cover',
    label: 'Cover Letter — Acme Corp',
    html: '<p>Cover</p>',
    pdfPath: '/storage/pdfs/doc-cover-1.pdf',
    createdAt: new Date('2026-06-02'),
  },
]

describe('ApplyPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('renders "Open posting" link with target _blank and correct href (applyUrl)', () => {
    render(<ApplyPanel job={mockJob} documents={[]} />)
    const link = screen.getByRole('link', { name: /open posting/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://acme.com/apply/1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('falls back to job.url when applyUrl is null', () => {
    const jobWithoutApplyUrl = { ...mockJob, applyUrl: null }
    render(<ApplyPanel job={jobWithoutApplyUrl} documents={[]} />)
    const link = screen.getByRole('link', { name: /open posting/i })
    expect(link).toHaveAttribute('href', 'https://acme.com/jobs/1')
  })

  it('renders CV download link', () => {
    render(<ApplyPanel job={mockJob} documents={mockDocuments} />)
    const link = screen.getByRole('link', { name: /CV — Acme Corp/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/api/documents/doc-cv-1/pdf')
  })

  it('renders cover letter download link', () => {
    render(<ApplyPanel job={mockJob} documents={mockDocuments} />)
    const link = screen.getByRole('link', { name: /Cover Letter — Acme Corp/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/api/documents/doc-cover-1/pdf')
  })

  it('renders "Mark applied" button', () => {
    render(<ApplyPanel job={mockJob} documents={[]} />)
    expect(screen.getByRole('button', { name: /mark applied/i })).toBeInTheDocument()
  })

  it('"Mark applied" button calls status endpoint with Applied', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...mockJob, status: 'Applied' }), { status: 200 })
    )

    render(<ApplyPanel job={mockJob} documents={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /mark applied/i }))

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

  it('shows confirmation after marking applied', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...mockJob, status: 'Applied' }), { status: 200 })
    )

    render(<ApplyPanel job={mockJob} documents={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /mark applied/i }))

    await waitFor(() => {
      expect(screen.getByText(/marked as applied/i)).toBeInTheDocument()
    })
  })
})
