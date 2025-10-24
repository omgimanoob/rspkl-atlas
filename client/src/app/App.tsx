import { useEffect, useState } from 'react'
import { Login } from '../pages/Login'
import { Dashboard } from '../pages/Dashboard'
import { ProjectsV2 } from '@/pages/ProjectsV2'
import { api } from '../lib/api'
import { Toaster } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { PageHeader } from '@/components/page-header'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { ErrorPage } from '@/pages/ErrorPage'
import { NotFound } from '@/pages/NotFound'
import { RequireRoles } from '@/components/Guard'
import { setStatusAnnouncer, setAlertAnnouncer } from '@/lib/a11y'
import { setOnUnauthorized } from '@/lib/auth'
import { ResetRequest } from '@/pages/ResetRequest'
import { ResetConfirm } from '@/pages/ResetConfirm'
import { Profile } from '@/pages/Profile'
import { AdminUsers } from '@/pages/admin/Users'
import { AdminRoles } from '@/pages/admin/Roles'
import { AdminPermissions } from '@/pages/admin/Permissions'
import { AdminGrants } from '@/pages/admin/Grants'
import { AdminStatuses } from '@/pages/admin/Statuses'

export default function App() {
  // Normalize path to avoid double-slash routing misses (e.g., //reset/request)
  if (typeof window !== 'undefined') {
    const { pathname, search, hash } = window.location
    const normalized = pathname.replace(/\/+/, '/').replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
    if (normalized !== pathname) {
      window.history.replaceState(null, '', normalized + search + hash)
    }
  }
  const [me, setMe] = useState<{ id: number; email: string; roles: string[]; displayName?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const u = await api.me()
        setMe({ id: u.id, email: u.email, roles: u.roles, displayName: u.display_name || undefined })
      } catch {
        setMe(null)
      } finally {
        setLoading(false)
      }
    })()
    // Centralized 401 handler: reset auth state
    setOnUnauthorized(() => setMe(null))
    return () => setOnUnauthorized(null)
  }, [])

  const [liveStatus, setLiveStatus] = useState('')
  const [liveAlert, setLiveAlert] = useState('')

  useEffect(() => {
    setStatusAnnouncer((msg) => setLiveStatus(msg))
    setAlertAnnouncer((msg) => setLiveAlert(msg))
    return () => { setStatusAnnouncer(null); setAlertAnnouncer(null) }
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  if (!me) {
    // Public routes: reset request/confirm; fallback to Login
    const publicRouter = createBrowserRouter([
      { path: '/reset', element: <ResetConfirm />, errorElement: <ErrorPage /> },
      { path: '/reset/request', element: <ResetRequest />, errorElement: <ErrorPage /> },
      // For any other route while logged out, show Login for a smoother experience
      { path: '*', element: <><Toaster richColors /><Login onLoggedIn={setMe} /></>, errorElement: <ErrorPage /> },
    ])
    return (
      <>
        <div className="sr-only" role="status" aria-live="polite">{liveStatus}</div>
        <div className="sr-only" role="alert" aria-live="assertive">{liveAlert}</div>
        <RouterProvider router={publicRouter} future={{ v7_startTransition: true }} />
      </>
    )
  }

  const RootLayout = () => (
    <SidebarProvider>
      <Toaster richColors />
      <AppSidebar me={me!} onLogout={async () => { try { await api.logout(); } finally { setMe(null) } }} />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )

  const router = createBrowserRouter([
    { path: '/reset', element: <ResetConfirm />, errorElement: <ErrorPage /> },
    { path: '/reset/request', element: <ResetRequest />, errorElement: <ErrorPage /> },
    {
      path: '/',
      element: <RootLayout />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', current: true }]} />
              <Dashboard me={me!} />
            </>
          ),
        },
        {
          path: 'projects',
          element: <Navigate to="/projects-v2" replace />,
        },
        {
          path: 'projects-v2',
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Projects', current: true }]} />
              <ProjectsV2 me={me!} />
            </>
          ),
        },
        {
          path: 'account',
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Account', current: true }]} />
              <Profile />
            </>
          ),
        },
        // Admin routes (show Forbidden when lacking permission)
        {
          path: 'console/users',
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Admin', href: '/console/users' }, { label: 'Users', current: true }]} />
              <RequireRoles me={me!} anyOf={['admins']}>
                <AdminUsers currentUserId={me!.id} />
              </RequireRoles>
            </>
          ),
        },
        {
          path: 'console/roles',
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Admin', href: '/console/roles' }, { label: 'Roles', current: true }]} />
              <RequireRoles me={me!} anyOf={['admins']}>
                <AdminRoles />
              </RequireRoles>
            </>
          ),
        },
        {
          path: 'console/permissions',
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Admin', href: '/console/permissions' }, { label: 'Permissions', current: true }]} />
              <RequireRoles me={me!} anyOf={['admins']}>
                <AdminPermissions />
              </RequireRoles>
            </>
          ),
        },
        {
          path: 'console/statuses',
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Admin', href: '/console/statuses' }, { label: 'Statuses', current: true }]} />
              <RequireRoles me={me!} anyOf={['admins']}>
                <AdminStatuses />
              </RequireRoles>
            </>
          ),
        },
        {
          path: 'console/grants',
          element: (
            <>
              <PageHeader trail={[{ label: 'Home', href: '/' }, { label: 'Admin', href: '/console/grants' }, { label: 'Grants', current: true }]} />
              <RequireRoles me={me!} anyOf={['admins']}>
                <AdminGrants />
              </RequireRoles>
            </>
          ),
        },
        { path: '*', element: <NotFound /> },
      ],
    },
  ])

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">{liveStatus}</div>
      <div className="sr-only" role="alert" aria-live="assertive">{liveAlert}</div>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </>
  )
}
