import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/jobs',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import Sidebar from '../Sidebar'

describe('Sidebar', () => {
  it('renders all nav links', () => {
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find jobs/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /my jobs/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /documents/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
  })

  it('marks the active route link with aria-current="page"', () => {
    render(<Sidebar />)
    const activeLink = screen.getByRole('link', { name: /my jobs/i })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark non-active links with aria-current="page"', () => {
    render(<Sidebar />)
    const inactiveLink = screen.getByRole('link', { name: /dashboard/i })
    expect(inactiveLink).not.toHaveAttribute('aria-current', 'page')
  })
})
