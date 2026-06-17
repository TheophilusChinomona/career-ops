'use client'

import { signOut, useSession } from '@/lib/auth-client'

export default function TopBar() {
  const { data: session } = useSession()
  const email = session?.user?.email ?? null
  const name = session?.user?.name ?? null

  return (
    <header className="h-12 flex items-center justify-end gap-4 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
      {(email ?? name) && (
        <span className="text-xs text-neutral-500 truncate max-w-[200px]">
          {email ?? name}
        </span>
      )}
      <button
        type="button"
        onClick={() => signOut()}
        className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
