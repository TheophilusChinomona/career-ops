import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import FindPage from '../page'

const mockJobs = [
  {
    id: 'job-1',
    company: 'TechCorp',
    role: 'Frontend Engineer',
    status: 'New',
    score: null,
    location: 'Remote',
  },
  {
    id: 'job-2',
    company: 'Startup Inc',
    role: 'Fullstack Dev',
    status: 'New',
    score: 4.0,
    location: null,
  },
]

describe('FindPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ added: 2, jobs: mockJobs }),
      }),
    )
  })

  it('renders a search input and submit button', () => {
    render(<FindPage />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('submits the query and renders the returned jobs', async () => {
    render(<FindPage />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'frontend engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(screen.getByText('TechCorp')).toBeInTheDocument()
      expect(screen.getByText('Startup Inc')).toBeInTheDocument()
    })
  })

  it('POSTs to /api/search with the query', async () => {
    render(<FindPage />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'react developer' } })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument())

    expect(fetch).toHaveBeenCalledWith(
      '/api/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'react developer' }),
      }),
    )
  })

  it('shows an added count message', async () => {
    render(<FindPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 added/i)).toBeInTheDocument()
    })
  })

  it('links each result to /jobs/[id]', async () => {
    render(<FindPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'dev' } })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      const links = screen.getAllByRole('link')
      const hrefs = links.map((l) => l.getAttribute('href'))
      expect(hrefs).toContain('/jobs/job-1')
      expect(hrefs).toContain('/jobs/job-2')
    })
  })

  it('shows error state on failed fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Search failed' }),
      }),
    )

    render(<FindPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument()
    })
  })
})
