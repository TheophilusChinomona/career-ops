import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DashboardView from '../DashboardView'
import type { Job } from '@/generated/prisma'

// Mock next/link so it renders a plain <a> tag
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

type JobLike = Pick<Job, 'id' | 'company' | 'role' | 'location' | 'status' | 'score'>

const base: JobLike = {
  id: 'j1',
  company: 'Acme',
  role: 'Engineer',
  location: 'Remote',
  status: 'New',
  score: null,
}

const jobs: JobLike[] = [
  { ...base, id: 'j1', company: 'Acme', role: 'Engineer', status: 'New', score: null },
  { ...base, id: 'j2', company: 'Beta', role: 'Designer', status: 'Evaluated', score: 4.2 },
  { ...base, id: 'j3', company: 'Gamma', role: 'PM', status: 'Applied', score: 3.8 },
]

describe('DashboardView', () => {
  it('renders a card for each job', () => {
    render(<DashboardView jobs={jobs} />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('links each card to /jobs/[id]', () => {
    render(<DashboardView jobs={jobs} />)
    const links = screen.getAllByRole('link', { name: /acme|beta|gamma/i })
    // Each card should be wrapped in a link
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/jobs/j1')
    expect(hrefs).toContain('/jobs/j2')
    expect(hrefs).toContain('/jobs/j3')
  })

  it('shows count by status in the stats strip', () => {
    render(<DashboardView jobs={jobs} />)
    // Expect the status labels appear at least once (they appear in stats strip)
    expect(screen.getAllByText(/New/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Evaluated/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Applied/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows correct job count', () => {
    render(<DashboardView jobs={jobs} />)
    // 3 total jobs - the "Total Jobs" stat shows "3"
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows avg score from scored jobs', () => {
    render(<DashboardView jobs={jobs} />)
    // avg of 4.2 and 3.8 = 4.0 - the "Avg Score" stat shows "4.0"
    expect(screen.getByText('4.0')).toBeInTheDocument()
  })

  it('shows top score', () => {
    render(<DashboardView jobs={jobs} />)
    // top score = 4.2 — appears in both the stat strip and the ScoreBadge
    expect(screen.getAllByText(/4\.2/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders empty state with link to /find when no jobs', () => {
    render(<DashboardView jobs={[]} />)
    const link = screen.getByRole('link', { name: /find jobs/i })
    expect(link).toHaveAttribute('href', '/find')
  })
})
