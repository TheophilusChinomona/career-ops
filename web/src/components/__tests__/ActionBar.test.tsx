import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ActionBar from '../ActionBar'

describe('ActionBar', () => {
  it('renders Evaluate button', () => {
    render(<ActionBar />)
    expect(screen.getByRole('button', { name: /evaluate/i })).toBeInTheDocument()
  })

  it('renders Tailor CV button', () => {
    render(<ActionBar />)
    expect(screen.getByRole('button', { name: /tailor cv/i })).toBeInTheDocument()
  })

  it('renders Cover Letter button', () => {
    render(<ActionBar />)
    expect(screen.getByRole('button', { name: /cover letter/i })).toBeInTheDocument()
  })

  it('renders Apply button', () => {
    render(<ActionBar />)
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument()
  })

  it('calls onEvaluate when Evaluate is clicked', () => {
    const onEvaluate = vi.fn()
    render(<ActionBar onEvaluate={onEvaluate} />)
    fireEvent.click(screen.getByRole('button', { name: /evaluate/i }))
    expect(onEvaluate).toHaveBeenCalledOnce()
  })

  it('calls onTailorCv when Tailor CV is clicked', () => {
    const onTailorCv = vi.fn()
    render(<ActionBar onTailorCv={onTailorCv} />)
    fireEvent.click(screen.getByRole('button', { name: /tailor cv/i }))
    expect(onTailorCv).toHaveBeenCalledOnce()
  })

  it('calls onCoverLetter when Cover Letter is clicked', () => {
    const onCoverLetter = vi.fn()
    render(<ActionBar onCoverLetter={onCoverLetter} />)
    fireEvent.click(screen.getByRole('button', { name: /cover letter/i }))
    expect(onCoverLetter).toHaveBeenCalledOnce()
  })

  it('calls onApply when Apply is clicked', () => {
    const onApply = vi.fn()
    render(<ActionBar onApply={onApply} />)
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onApply).toHaveBeenCalledOnce()
  })
})
