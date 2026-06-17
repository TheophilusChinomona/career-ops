import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import JobDetailView from '@/components/JobDetailView'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: PageProps) {
  // Next 16: params is async
  const { id } = await params

  // Next 16: headers() is async
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  const userId = session.user.id

  // Load job + evaluation + documents in parallel
  const [job, evaluation, documents] = await Promise.all([
    db.job.findFirst({ where: { id, userId } }),
    db.evaluation.findUnique({ where: { jobId: id } }),
    db.document.findMany({ where: { jobId: id, userId }, orderBy: { createdAt: 'desc' } }),
  ])

  if (!job) {
    notFound()
  }

  return (
    <JobDetailView
      job={job}
      evaluation={evaluation}
      documents={documents}
    />
  )
}
