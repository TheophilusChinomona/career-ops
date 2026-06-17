import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 p-6 bg-neutral-50 dark:bg-neutral-900">
          {children}
        </main>
      </div>
    </div>
  )
}
