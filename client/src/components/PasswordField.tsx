import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function PasswordRequirements({ value }: { value: string }) {
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

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  name,
  autoComplete,
  disabled,
  showRequirements,
}: {
  id: string
  label: string
  value: string
  onChange: (val: string) => void
  error?: string | null
  name?: string
  autoComplete?: string
  disabled?: boolean
  showRequirements?: boolean
}) {
  const [show, setShow] = useState(false)
  const errId = error ? `${id}-err` : undefined
  return (
    <div>
      <label htmlFor={id} className="text-xs text-gray-600 mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          name={name}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={errId}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setShow(v => !v)} disabled={disabled}>
          {show ? 'Hide' : 'Show'}
        </Button>
      </div>
      {error && <div id={errId} className="text-xs text-red-600 mt-1">{error}</div>}
      {showRequirements && <PasswordRequirements value={value} />}
    </div>
  )
}

