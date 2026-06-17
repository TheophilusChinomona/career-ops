import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ScoreBadge from '../ScoreBadge'

describe('ScoreBadge', () => {
  it('formats the score as "X.X/5"', () => {
    render(<ScoreBadge score={4.1} />)
    expect(screen.getByText('4.1/5')).toBeInTheDocument()
  })

  it('applies green class for score >= 4', () => {
    const { container } = render(<ScoreBadge score={4.1} />)
    expect(container.firstChild).toHaveClass('badge-green')
  })

  it('applies amber class for score >= 3 and < 4', () => {
    const { container } = render(<ScoreBadge score={3.2} />)
    expect(container.firstChild).toHaveClass('badge-amber')
  })

  it('applies red class for score < 3', () => {
    const { container } = render(<ScoreBadge score={2.0} />)
    expect(container.firstChild).toHaveClass('badge-red')
  })

  it('applies green class for exact score of 4', () => {
    const { container } = render(<ScoreBadge score={4.0} />)
    expect(container.firstChild).toHaveClass('badge-green')
  })

  it('applies amber class for exact score of 3', () => {
    const { container } = render(<ScoreBadge score={3.0} />)
    expect(container.firstChild).toHaveClass('badge-amber')
  })
})
