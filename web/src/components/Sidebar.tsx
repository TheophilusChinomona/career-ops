'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Find Jobs', href: '/find' },
  { label: 'My Jobs', href: '/jobs' },
  { label: 'Documents', href: '/documents' },
  { label: 'Profile', href: '/profile' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-neutral-950 text-neutral-100 flex flex-col py-8 px-4 shrink-0">
      <div className="mb-8 px-2">
        <span className="text-sm font-semibold tracking-widest uppercase text-neutral-400">
          CareerOps
        </span>
      </div>
      <nav aria-label="Main navigation">
        <ul className="flex flex-col gap-1">
          {navItems.map(({ label, href }) => {
            const isActive = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'block rounded px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white',
                  ].join(' ')}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
