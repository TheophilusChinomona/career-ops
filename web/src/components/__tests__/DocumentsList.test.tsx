import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DocumentsList from '../DocumentsList'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockDocuments = [
  {
    id: 'doc-1',
    type: 'cv',
    label: 'Tailored CV – TechCorp',
    createdAt: new Date('2026-06-01T10:00:00Z'),
    jobId: 'job-1',
    job: { company: 'TechCorp', role: 'Senior Engineer' },
  },
  {
    id: 'doc-2',
    type: 'cover',
    label: 'Cover Letter – Acme',
    createdAt: new Date('2026-06-02T10:00:00Z'),
    jobId: 'job-2',
    job: { company: 'Acme', role: 'Product Manager' },
  },
  {
    id: 'doc-3',
    type: 'cv',
    label: 'Base CV',
    createdAt: new Date('2026-06-03T10:00:00Z'),
    jobId: null,
    job: null,
  },
]

describe('DocumentsList', () => {
  it('renders a row for each document', () => {
    render(<DocumentsList documents={mockDocuments} />)
    expect(screen.getByText('Tailored CV – TechCorp')).toBeInTheDocument()
    expect(screen.getByText('Cover Letter – Acme')).toBeInTheDocument()
    expect(screen.getByText('Base CV')).toBeInTheDocument()
  })

  it('renders document type for each row', () => {
    render(<DocumentsList documents={mockDocuments} />)
    // "cv" appears twice
    const cvTypes = screen.getAllByText(/^cv$/i)
    expect(cvTypes).toHaveLength(2)
    expect(screen.getByText(/^cover$/i)).toBeInTheDocument()
  })

  it('renders download link with correct href for each document', () => {
    render(<DocumentsList documents={mockDocuments} />)
    const links = screen.getAllByRole('link', { name: /download/i })
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', '/api/documents/doc-1/pdf')
    expect(links[1]).toHaveAttribute('href', '/api/documents/doc-2/pdf')
    expect(links[2]).toHaveAttribute('href', '/api/documents/doc-3/pdf')
  })

  it('renders linked job company and role when present', () => {
    render(<DocumentsList documents={mockDocuments} />)
    // getByText with exact=false may match multiple elements; use getAllByText
    expect(screen.getAllByText(/TechCorp/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Senior Engineer/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Acme/).length).toBeGreaterThan(0)
  })

  it('shows a dash or empty cell when no job is linked', () => {
    render(<DocumentsList documents={mockDocuments} />)
    // doc-3 has no job — should render a dash
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders empty state when no documents', () => {
    render(<DocumentsList documents={[]} />)
    expect(screen.getByText(/no documents/i)).toBeInTheDocument()
  })
})
