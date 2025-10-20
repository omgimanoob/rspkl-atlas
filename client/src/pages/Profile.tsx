import { useEffect, useState } from 'react'
import { api, extractApiReason } from '@/lib/api'
import { validatePasswordClient } from '@/lib/password'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import React from 'react'
import { PasswordField } from '@/components/PasswordField'
import { announceStatus } from '@/lib/a11y'

// Requirements list now provided by PasswordField when showRequirements is true

export function Profile() {
  const [me, setMe] = useState<{ id: number; email: string; display_name?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [currPwd, setCurrPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changing, setChanging] = useState(false)
  const [currErr, setCurrErr] = useState<string | null>(null)
  const [newErr, setNewErr] = useState<string | null>(null)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [showCurr, setShowCurr] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const u = await api.me()
        setMe({ id: u.id, email: u.email, display_name: u.display_name || '' })
        setDisplayName(u.display_name || '')
      } catch {}
      setLoading(false)
    })()
  }, [])

  const saveName = async () => {
    try {
      const trimmed = displayName.trim()
      if (!trimmed) {
        toast.info('Nothing to save')
        return
      }
      setSavingName(true)
      const res = await api.updateMe({ display_name: trimmed })
      toast.success('Profile updated')
      announceStatus('Profile updated')
      setDisplayName(res.display_name || trimmed)
    } catch (e: any) {
      toast.error('Failed to update profile')
    } finally {
      setSavingName(false)
    }
  }

  const changePassword = async () => {
    try {
      setCurrErr(null); setNewErr(null); setConfirmErr(null)
      if (!currPwd) { setCurrErr('Enter your current password'); return }
      if (!newPwd) { setNewErr('Enter a new password'); return }
      const pwErr = validatePasswordClient(newPwd)
      if (pwErr) { setNewErr(pwErr); return }
      if (newPwd !== confirmPwd) { setConfirmErr('Passwords do not match'); return }
      setChanging(true)
      await api.changePassword({ current_password: currPwd, new_password: newPwd })
      toast.success('Password changed')
      announceStatus('Password changed')
      setCurrPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (e: any) {
      const reason = extractApiReason(e)
      if (reason === 'invalid_current_password') setCurrErr('Current password is incorrect')
      else if (reason === 'weak_password') setNewErr('New password is too weak')
      else toast.error('Failed to change password')
    } finally {
      setChanging(false)
    }
  }

  if (loading) return <div className="p-6">Loading…</div>
  if (!me) return <div className="p-6">Not signed in</div>

  return (
    <div className="p-4 space-y-8 max-w-2xl">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="space-y-2">
          <div>
            <label htmlFor="profile-email" className="text-xs text-gray-600 mb-1">Email</label>
            <div id="profile-email" className="text-sm">{me.email}</div>
          </div>
          <div>
            <label htmlFor="display-name" className="text-xs text-gray-600 mb-1">Display name</label>
            <div className="flex items-center gap-2">
              <Input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Enter new display name" name="nickname" autoComplete="nickname" />
              <Button onClick={saveName} disabled={savingName || displayName.trim().length === 0}>{savingName ? 'Saving…' : 'Save'}</Button>
            </div>
            <div className="text-xs text-gray-500 mt-1">Leave blank to make no changes.</div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <form
          className="space-y-2"
          onSubmit={(e) => { e.preventDefault(); changePassword(); }}
          autoComplete="on"
        >
          {/* Include username field for password managers/autocomplete */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={me.email}
            readOnly
            aria-hidden="true"
            className="sr-only"
            tabIndex={-1}
          />
          <PasswordField id="current-password" label="Current password" value={currPwd} onChange={setCurrPwd} error={currErr || undefined} name="current-password" autoComplete="current-password" />
          <div>
            <PasswordField id="new-password" label="New password" value={newPwd} onChange={setNewPwd} error={newErr || undefined} name="new-password" autoComplete="new-password" showRequirements />
          </div>
          <PasswordField id="confirm-password" label="Confirm new password" value={confirmPwd} onChange={setConfirmPwd} error={confirmErr || undefined} name="new-password" autoComplete="new-password" />
          <Button type="submit" disabled={changing}>{changing ? 'Changing…' : 'Change password'}</Button>
        </form>
      </section>
    </div>
  )
}
