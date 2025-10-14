import { useEffect, useState } from 'react'
import { Login } from '../pages/Login'
import { Projects } from '../pages/Projects'
import { api } from '../lib/api'
import { Toaster } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { PageHeader } from '@/components/page-header'

export default function App() {
  const [me, setMe] = useState<{ email: string; roles: string[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const u = await api.me()
        setMe(u)
      } catch {
        setMe(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  if (!me) return (
    <>
      <Toaster richColors />
      <Login onLoggedIn={setMe} />
    </>
  )

  return (
    <SidebarProvider>
      <Toaster richColors />
      <AppSidebar me={me} onLogout={async () => { try { await api.logout(); } finally { setMe(null) } }} />
      <SidebarInset>
        <PageHeader
          title="Projects"
          trail={[{ label: 'Home', href: '#' }, { label: 'Projects', current: true }]}
          right={<div className="text-sm text-gray-600">{me.email} · {me.roles.join(', ')}</div>}
        />
        <div className="gap-2 px-4">
          <Projects me={me} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
