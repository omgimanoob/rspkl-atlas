import { useEffect, useState } from 'react'
import { Login } from '../pages/Login'
import { Projects } from '../pages/Projects'
import { Dashboard } from '../pages/Dashboard'
import { api } from '../lib/api'
import { Toaster } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { PageHeader } from '@/components/page-header'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

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
    <BrowserRouter>
      <SidebarProvider>
        <Toaster richColors />
        <AppSidebar me={me} onLogout={async () => { try { await api.logout(); } finally { setMe(null) } }} />
        <SidebarInset>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <PageHeader trail={[{ label: 'Home', current: true }]} />
                  <Dashboard me={me} />
                </>
              }
            />
            <Route
              path="/projects"
              element={
                <>
                  <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Projects', current: true }]} />
                  <Projects me={me} />
                </>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SidebarInset>
      </SidebarProvider>
    </BrowserRouter>
  )
}
