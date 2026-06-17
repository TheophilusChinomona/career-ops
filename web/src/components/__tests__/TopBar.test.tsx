import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock auth-client: useSession returns a signed-in user
vi.mock('@/lib/auth-client', () => ({
  signOut: vi.fn(),
  useSession: () => ({
    data: { user: { email: 'tino@example.com', name: 'Tino' } },
    isPending: false,
  }),
}))

import TopBar from '../TopBar'

describe('TopBar', () => {
  it('renders Sign out button', () => {
    render(<TopBar />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows the signed-in user email', () => {
    render(<TopBar />)
    expect(screen.getByText('tino@example.com')).toBeInTheDocument()
  })
})
