'use client'

import { signOut, useSession } from '@/lib/auth-client'

export default function TopBar() {
  const { data: session } = useSession()
  const email = session?.user?.email ?? null
  const name = session?.user?.name ?? null

  return (
    <header className="h-12 flex items-center justify-end gap-4 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
      {(email ?? name) && (
        <span className="text-sm text-neutral-600 dark:text-neutral-300 truncate max-w-[220px]">
          {email ?? name}
        </span>
      )}
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        Sign out
      </button>
    </header>
  )
}
