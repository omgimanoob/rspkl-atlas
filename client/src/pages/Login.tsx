import { useState } from 'react'
import { api } from '../lib/api'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

export function Login({ onLoggedIn }: { onLoggedIn: (u: any) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.login(email, password)
      onLoggedIn(res)
    } catch (e: any) {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border rounded p-6">
        <h1 className="text-xl font-semibold">Atlas Login</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <Button disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  )
}
