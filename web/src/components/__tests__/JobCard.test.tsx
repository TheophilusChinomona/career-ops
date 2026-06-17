import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import JobCard from '../JobCard'
import type { Job } from '@/generated/prisma'

const mockJob: Pick<Job, 'id' | 'company' | 'role' | 'location' | 'status' | 'score'> = {
  id: 'job-1',
  company: 'Acme Corp',
  role: 'Senior Engineer',
  location: 'Remote',
  status: 'Evaluated',
  score: 4.2,
}

describe('JobCard', () => {
  it('renders the company name', () => {
    render(<JobCard job={mockJob} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('renders the role', () => {
    render(<JobCard job={mockJob} />)
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
  })

  it('renders the score via ScoreBadge', () => {
    render(<JobCard job={mockJob} />)
    expect(screen.getByText('4.2/5')).toBeInTheDocument()
  })

  it('renders the status', () => {
    render(<JobCard job={mockJob} />)
    expect(screen.getByText('Evaluated')).toBeInTheDocument()
  })

  it('renders without score when score is null', () => {
    render(<JobCard job={{ ...mockJob, score: null }} />)
    expect(screen.queryByText('/5')).not.toBeInTheDocument()
  })
})
