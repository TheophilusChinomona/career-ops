import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import EvaluationView from '../EvaluationView'
import type { EvaluationOut } from '@/llm/schemas'

const mockEvaluation: EvaluationOut = {
  score: 4.1,
  legitimacy: 'High Confidence',
  recommendApply: true,
  blocks: {
    A: 'Strong role-fit match across 5 of 6 requirements.',
    B: 'Remote-first, competitive salary band.',
    C: 'Series B startup, strong growth trajectory.',
    D: 'Some skill gaps in Rust and embedded systems.',
    E: 'Solid ATS score, tailor for cloud keywords.',
    F: 'Negotiation leverage: competing offer in hand.',
    G: 'Posting is live and verified on Lever.',
  },
  notes: 'Good opportunity overall.',
}

describe('EvaluationView', () => {
  it('renders block A label and text', () => {
    render(<EvaluationView evaluation={mockEvaluation} />)
    expect(screen.getByText(/block a/i)).toBeInTheDocument()
    expect(screen.getByText(/strong role-fit match/i)).toBeInTheDocument()
  })

  it('renders block B label and text', () => {
    render(<EvaluationView evaluation={mockEvaluation} />)
    expect(screen.getByText(/block b/i)).toBeInTheDocument()
    expect(screen.getByText(/remote-first/i)).toBeInTheDocument()
  })

  it('renders block C label and text', () => {
    render(<EvaluationView evaluation={mockEvaluation} />)
    expect(screen.getByText(/block c/i)).toBeInTheDocument()
    expect(screen.getByText(/series b startup/i)).toBeInTheDocument()
  })

  it('renders block D label and text', () => {
    render(<EvaluationView evaluation={mockEvaluation} />)
    expect(screen.getByText(/block d/i)).toBeInTheDocument()
    expect(screen.getByText(/skill gaps/i)).toBeInTheDocument()
  })

  it('renders block E label and text', () => {
    render(<EvaluationView evaluation={mockEvaluation} />)
    expect(screen.getByText(/block e/i)).toBeInTheDocument()
    expect(screen.getByText(/solid ats score/i)).toBeInTheDocument()
  })

  it('renders block F label and text', () => {
    render(<EvaluationView evaluation={mockEvaluation} />)
    expect(screen.getByText(/block f/i)).toBeInTheDocument()
    expect(screen.getByText(/negotiation leverage/i)).toBeInTheDocument()
  })

  it('renders block G label and text', () => {
    render(<EvaluationView evaluation={mockEvaluation} />)
    expect(screen.getByText(/block g/i)).toBeInTheDocument()
    expect(screen.getByText(/posting is live/i)).toBeInTheDocument()
  })
})
