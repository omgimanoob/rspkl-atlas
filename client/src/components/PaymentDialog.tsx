import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { toast } from 'sonner'

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function PaymentDialog({ open, onOpenChange, defaultKimaiId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; defaultKimaiId?: number | null; onSaved?: () => void }) {
  const [kimaiId, setKimaiId] = useState<number | null>(defaultKimaiId ?? null)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<any[]>([])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState<string>(() => todayLocal())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const isValid = useMemo(() => {
    const hasProject = typeof kimaiId === 'number' && Number.isFinite(kimaiId)
    const amt = Number(parseFloat(amount))
    const hasAmount = amount.trim() !== '' && Number.isFinite(amt)
    const hasDate = !!date
    return hasProject && hasAmount && hasDate
  }, [kimaiId, amount, date])

  function resetForm() {
    setKimaiId(defaultKimaiId ?? null)
    setQuery('')
    setAmount('')
    setDate(todayLocal())
    setNotes('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetForm()
    }
    onOpenChange(next)
  }

  useEffect(() => { setKimaiId(defaultKimaiId ?? null) }, [defaultKimaiId])
  // Ensure default date on open (handles cases where prior interactions cleared it)
  useEffect(() => { if (open && !date) setDate(todayLocal()) }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const pageSize = 100
        let page = 1
        let total = 0
        const acc: any[] = []
        do {
          const res = await api.v2.projects({ include: ['kimai'], page, pageSize })
          const items = (res.items || []).filter((r: any) => r.origin === 'kimai')
          acc.push(...items)
          total = Number(res.total || acc.length)
          page += 1
        } while (acc.length < total && page <= 50) // hard cap to avoid runaway
        if (alive) setOptions(acc)
      } catch { if (alive) setOptions([]) }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [open])

  const filtered = useMemo(() => {
    if (!query) return options
    const q = query.toLowerCase()
    return options.filter(o => (
      String(o.displayName || '').toLowerCase().includes(q) ||
      String(o.comment || '').toLowerCase().includes(q) ||
      String(o.notes || '').toLowerCase().includes(q)
    ))
  }, [options, query])

  const selected = useMemo(() => options.find(o => (o.kimaiId || o.id) === kimaiId) || null, [options, kimaiId])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Payment</DialogTitle>
          <DialogDescription>Record a payment against a Kimai project.</DialogDescription>
        </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Select Project</div>
              <Input placeholder="Search by name/comment/notes…" value={query} onChange={e => setQuery(e.target.value)} />
              <div className="border rounded h-48 overflow-auto">
                {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>}
                {!loading && filtered.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>}
                {!loading && filtered.map(p => {
                const id = p.kimaiId || p.id
                const name = p.displayName || p.name || `#${id}`
                const comment = p.comment || ''
                const notes = p.notes || ''
                const isSel = kimaiId === id
                return (
                  <button key={id} type="button" onClick={() => setKimaiId(id)} className={`block w-full text-left px-3 py-2 hover:bg-muted ${isSel ? 'bg-muted' : ''} overflow-hidden min-w-0`}>
                    <div className="font-medium truncate max-w-full min-w-0" title={name}>{name}</div>
                  </button>
                )
              })}
            </div>
          </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Amount</div>
                <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Payment Date</div>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Notes</div>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button disabled={saving || !isValid} onClick={async () => {
            if (!Number.isFinite(Number(kimaiId))) { toast.error('Select a project'); return }
            const amt = Number(parseFloat(amount))
            if (!Number.isFinite(amt)) { toast.error('Enter a valid amount'); return }
            if (!date) { toast.error('Select a date'); return }
            try {
              setSaving(true)
              await api.payments.create({ kimai_project_id: Number(kimaiId), amount: amt, payment_date: date, notes: notes || undefined })
              toast.success('Payment recorded')
              onOpenChange(false)
              setKimaiId(defaultKimaiId ?? null)
              setAmount('')
              setDate('')
              setNotes('')
              onSaved?.()
            } catch (e: any) {
              const reason = e?.payload?.reason
              const map: any = { override_missing: 'No override exists for the selected project' }
              toast.error(map[reason] || 'Failed to create payment')
            } finally { setSaving(false) }
          }}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
