import { useState } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { announceAlert, announceStatus } from '@/lib/a11y'

export function ResetRequest() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rateErr, setRateErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { toast.error('Enter your email'); return }
    try {
      setLoading(true)
      setRateErr(null)
      await api.requestPasswordReset({ email: email.trim() })
      setSent(true)
      toast.success('If an account exists, a reset email was sent')
      announceStatus('If an account exists, a reset email was sent')
    } catch (e: any) {
      // Always show success state to avoid enumeration
      if (e?.status === 429) {
        setRateErr('Too many requests. Please wait a while and try again.')
        announceAlert('Too many reset requests. Please wait and try again')
        return
      }
      setSent(true)
      toast.success('If an account exists, a reset email was sent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-4 border rounded p-6">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {rateErr && (
          <div className="text-sm text-red-600">{rateErr}</div>
        )}
        {sent ? (
          <div className="text-sm text-gray-700">
            If an account exists for <strong>{email}</strong>, you will receive an email with instructions to reset your password.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1" htmlFor="reset-email">Email</label>
              <Input id="reset-email" type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
          </form>
        )}
        <div className="text-sm text-gray-500">Remembered your password? <a href="/" className="ml-auto inline-block font-medium text-sm underline-offset-4 hover:underline">Go back to Login</a>.</div>
      </div>
    </div>
  )
}
