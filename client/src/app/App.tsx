import { useEffect, useState } from 'react'
import { Login } from '../pages/Login'
import { Projects } from '../pages/Projects'
import { api } from '../lib/api'

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

  if (!me) return <Login onLoggedIn={setMe} />

  return <Projects me={me} />
}

