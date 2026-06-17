import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileForm from '../ProfileForm'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const mockProfile = {
  id: 'profile-1',
  userId: 'user-1',
  fullName: 'Tino Maramba',
  email: 'tino@example.com',
  phone: '+263 77 000 0000',
  location: 'Harare, Zimbabwe',
  linkedin: 'https://linkedin.com/in/tino',
  targetRoles: ['Project Coordinator', 'Operations Manager'],
  compTarget: '$60k–$80k',
  narrative: 'Experienced coordinator',
  llmProvider: 'claude',
  model: 'claude-opus-4-5',
}

const mockCvMaster = {
  id: 'cv-1',
  userId: 'user-1',
  summary: 'Experienced professional with 10 years in operations.',
  experience: [
    {
      company: 'ACME Corp',
      role: 'Project Coordinator',
      location: 'Harare',
      period: '2020–2024',
      bullets: ['Led cross-functional teams', 'Improved efficiency by 30%'],
    },
  ],
  education: [
    {
      title: 'BSc Computer Science',
      org: 'University of Zimbabwe',
      period: '2015–2019',
      desc: 'First Class Honours',
    },
  ],
  certs: ['PMP', 'AWS Solutions Architect'],
  skills: [
    { category: 'Project Management', items: ['MS Project', 'Jira', 'Trello'] },
  ],
}

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: mockProfile, cvMaster: mockCvMaster }),
    }))
  })

  it('renders fullName field with initial value', () => {
    render(<ProfileForm initialProfile={mockProfile} initialCvMaster={mockCvMaster} />)
    const input = screen.getByLabelText(/full name/i)
    expect(input).toHaveValue('Tino Maramba')
  })

  it('renders email field with initial value', () => {
    render(<ProfileForm initialProfile={mockProfile} initialCvMaster={mockCvMaster} />)
    expect(screen.getByLabelText(/email/i)).toHaveValue('tino@example.com')
  })

  it('renders CV summary textarea with initial value', () => {
    render(<ProfileForm initialProfile={mockProfile} initialCvMaster={mockCvMaster} />)
    expect(screen.getByLabelText(/summary/i)).toHaveValue(
      'Experienced professional with 10 years in operations.'
    )
  })

  it('editing fullName and submitting calls /api/profile with updated value', async () => {
    render(<ProfileForm initialProfile={mockProfile} initialCvMaster={mockCvMaster} />)

    const nameInput = screen.getByLabelText(/full name/i)
    fireEvent.change(nameInput, { target: { value: 'Tinotenda Maramba' } })

    const submitBtn = screen.getByRole('button', { name: /save profile/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({ method: 'POST' })
      )
    })

    // Verify the edited value is in the body
    const [, callOptions] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse((callOptions as RequestInit).body as string)
    expect(body.fullName).toBe('Tinotenda Maramba')
  })

  it('submitting sends email in the payload', async () => {
    render(<ProfileForm initialProfile={mockProfile} initialCvMaster={mockCvMaster} />)

    const submitBtn = screen.getByRole('button', { name: /save profile/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/profile', expect.anything())
    })

    const [, callOptions] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse((callOptions as RequestInit).body as string)
    expect(body.email).toBe('tino@example.com')
  })

  it('seed button calls /api/profile/seed', async () => {
    render(<ProfileForm initialProfile={mockProfile} initialCvMaster={mockCvMaster} />)

    const seedBtn = screen.getByRole('button', { name: /seed from repo/i })
    fireEvent.click(seedBtn)

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/profile/seed',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('shows success message after save', async () => {
    render(<ProfileForm initialProfile={mockProfile} initialCvMaster={mockCvMaster} />)

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument()
    })
  })
})
