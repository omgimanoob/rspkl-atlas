import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api, extractApiReason } from '@/lib/api'
import React from 'react'
import { announceStatus, announceAlert } from '@/lib/a11y'
import { PasswordField } from '@/components/PasswordField'
import { validatePasswordClient } from '@/lib/password'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ResetConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => params.get('token') || '', [params])
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [newErr, setNewErr] = useState<string | null>(null)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null); setNewErr(null); setConfirmErr(null)
    if (!token) { setFormErr('Missing or invalid reset link'); return }
    if (!newPwd) { setNewErr('Enter a new password'); return }
    const pwErr = validatePasswordClient(newPwd)
    if (pwErr) { setNewErr(pwErr); return }
    if (newPwd !== confirmPwd) { setConfirmErr('Passwords do not match'); return }
    try {
      setLoading(true)
      await api.confirmPasswordReset({ token, new_password: newPwd })
      toast.success('Password reset successful. Please log in.')
      announceStatus('Password reset successful')
      navigate('/', { replace: true })
    } catch (e: any) {
      const reason = extractApiReason(e)
      if (reason === 'weak_password') setNewErr('New password is too weak')
      else if (reason === 'invalid_token' || reason === 'token_used' || reason === 'token_expired') setFormErr('This reset link is invalid or has expired')
      else { setFormErr('Failed to reset password'); announceAlert('Failed to reset password') }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-full grid place-items-center p-6">
        <div className="w-full max-w-sm space-y-4 border rounded p-6">
          <h1 className="text-xl font-semibold">Invalid link</h1>
          <div className="text-sm text-gray-700">This reset link is invalid. You can request a new one from the reset page.</div>
          <a className="text-sm text-blue-600 underline" href="/reset/request">Go to Reset Request</a>
        </div>
      </div>
    )
  }

  const Requirements = ({ value }: { value: string }) => {
    const s = String(value || '')
    const reqs = [
      { label: 'At least 8 characters', ok: s.length >= 8 },
      { label: 'Uppercase letter', ok: /[A-Z]/.test(s) },
      { label: 'Lowercase letter', ok: /[a-z]/.test(s) },
      { label: 'Number', ok: /[0-9]/.test(s) },
      { label: 'Symbol', ok: /[^A-Za-z0-9]/.test(s) },
    ]
    return (
      <ul className="mt-2 text-xs space-y-1">
        {reqs.map((r, i) => (
          <li key={i} className={r.ok ? 'text-green-600' : 'text-gray-500'}>
            {r.ok ? '✓' : '•'} {r.label}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border rounded p-6" autoComplete="on">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        {formErr && <div className="text-sm text-red-600">{formErr}</div>}
        {/* Hidden username field for accessibility/password managers */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          aria-hidden="true"
          className="sr-only"
          tabIndex={-1}
          value={''}
          readOnly
        />
        <PasswordField id="new-password" label="New password" value={newPwd} onChange={setNewPwd} error={newErr || undefined} name="new-password" autoComplete="new-password" showRequirements />
        <div>
          <PasswordField id="confirm-password" label="Confirm new password" value={confirmPwd} onChange={setConfirmPwd} error={confirmErr || undefined} name="new-password" autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Reset password'}</Button>
        <div className="text-xs text-gray-500">Your link will expire shortly. If it fails, request a new one.</div>
      </form>
    </div>
  )
}
