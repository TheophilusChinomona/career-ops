import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import DocumentsList from '@/components/DocumentsList'

export default async function DocumentsPage() {
  // Next 16: headers() is async
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  const userId = session.user.id

  const documents = await db.document.findMany({
    where: { userId },
    include: { job: { select: { company: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-6">
        Documents
      </h1>
      <DocumentsList documents={documents} />
    </div>
  )
}
