import Link from 'next/link'

interface Job {
  company: string
  role: string
}

interface DocumentItem {
  id: string
  type: string
  label: string
  createdAt: Date
  jobId: string | null
  job: Job | null
}

interface DocumentsListProps {
  documents: DocumentItem[]
}

export default function DocumentsList({ documents }: DocumentsListProps) {
  if (documents.length === 0) {
    return (
      <p className="text-neutral-500 text-sm py-8 text-center">
        No documents yet. Generate a tailored CV or cover letter from a job page.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-700">
            <th className="text-left py-3 px-4 font-semibold text-neutral-600 dark:text-neutral-400">
              Type
            </th>
            <th className="text-left py-3 px-4 font-semibold text-neutral-600 dark:text-neutral-400">
              Label
            </th>
            <th className="text-left py-3 px-4 font-semibold text-neutral-600 dark:text-neutral-400">
              Job
            </th>
            <th className="text-left py-3 px-4 font-semibold text-neutral-600 dark:text-neutral-400">
              Created
            </th>
            <th className="text-left py-3 px-4 font-semibold text-neutral-600 dark:text-neutral-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr
              key={doc.id}
              className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 uppercase">
                  {doc.type}
                </span>
              </td>
              <td className="py-3 px-4 text-neutral-900 dark:text-neutral-100">
                {doc.label}
              </td>
              <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                {doc.job ? (
                  <span>
                    {doc.job.company} — {doc.job.role}
                  </span>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400">
                {new Date(doc.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 px-4">
                <Link
                  href={`/api/documents/${doc.id}/pdf`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline text-sm"
                >
                  Download
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
