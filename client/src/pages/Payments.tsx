import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
// Removed inline pagination controls; using TablePagination
import { Textarea } from '@/components/ui/textarea'
import { PaymentDialog } from '@/components/PaymentDialog'
import { Amount } from '@/components/Amount'
import { TablePagination } from '@/components/TablePagination'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronsUpDown, ArrowUp, ArrowDown, Columns as ColumnsIcon, ChevronDown, Plus } from 'lucide-react'
import { formatLocalPopoverYYYY, formatDateDDMMYYYY } from '@/lib/datetime'

const defaultVisibleColumns = [
  'projectId',
  'projectName',
  'amount',
  'paymentDate',
  'createdBy',
  'notes',
] as const

export function Payments({ me }: { me?: { email: string; roles: string[] } }) {
  const loc = useLocation()
  const params = new URLSearchParams(loc.search)
  const initialKimai = params.get('kimai') ? Number(params.get('kimai')) : null
  const [q, setQ] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<string>('payment_date:desc')
  const amountWidthCh = useMemo(() => {
    try {
      const lens = items.map(r => {
        const n = Number(r.amount) || 0
        const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        return s.length + (n < 0 ? 1 : 0)
      })
      return Math.max(8, ...lens)
    } catch { return 8 }
  }, [items])
  const allColumns = useMemo(() => ([
    { id: 'projectId', label: 'Project ID', sortable: false as const },
    { id: 'projectName', label: 'Project Name', sortable: true as const, sortKey: 'project_name' },
    { id: 'amount', label: 'Amount', sortable: true as const, sortKey: 'amount' },
    { id: 'paymentDate', label: 'Payment Date', sortable: true as const, sortKey: 'payment_date' },
    { id: 'notes', label: 'Notes', sortable: false as const },
    { id: 'createdBy', label: 'Created By', sortable: false as const },
  ]), [])
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('payments:cols')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length) return new Set(arr)
      }
    } catch { }
    return new Set(defaultVisibleColumns)
  })
  const isAdmin = !!me?.roles?.includes('admins')
  const canCreate = isAdmin || me?.roles?.some(r => ['hr', 'directors'].includes(r))

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createKimaiId, setCreateKimaiId] = useState<number | null>(initialKimai)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewRow, setViewRow] = useState<any | null>(null)

  // Persist columns
  useEffect(() => {
    try { localStorage.setItem('payments:cols', JSON.stringify(Array.from(visibleCols))) } catch { }
  }, [visibleCols])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('payments:cols')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length) setVisibleCols(new Set(arr))
      }
    } catch { }
  }, [])

  async function load(params: { q?: string } = {}) {
    setLoading(true)
    try {
      const res = await api.payments.list({ q: params.q ?? q, page, pageSize, sort, kimai: initialKimai != null ? initialKimai : undefined })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [page, pageSize, sort])


  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 hidden sm:inline">
          <div className="text-base font-semibold">Payments</div>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search project name/comment/notes…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load({ q: (e.target as HTMLInputElement).value }) } }} className="max-w-xs" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon className="h-4 w-4" />
                <span className="hidden lg:inline">Customize Columns</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allColumns.map(c => (
                <DropdownMenuCheckboxItem key={c.id} checked={visibleCols.has(c.id)} onCheckedChange={(v) => {
                  const next = new Set(visibleCols)
                  if (v) next.add(c.id); else next.delete(c.id)
                  if (next.size === 0) return
                  setVisibleCols(next)
                }}>{c.label}</DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setVisibleCols(new Set(defaultVisibleColumns))}>Reset to default</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} disabled={!canCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline">Enter payment</span>
            <span className="sr-only lg:hidden">Enter payment</span>
          </Button>
        </div>
      </div>
      <div className="border rounded  overflow-x-auto">
        <div className="w-max md:w-full">
          {(() => {
            const visible = allColumns.filter(c => visibleCols.has(c.id))
            const count = visible.length
            const gridCls = count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : count === 4 ? 'grid-cols-4' : count === 5 ? 'grid-cols-5' : 'grid-cols-6'
            const sortKey = (id: string) => (allColumns.find(c => c.id === id) as any)?.sortKey as string | undefined
            const currentKey = sort.split(':')[0]
            const currentDir = (sort.split(':')[1] || 'asc') as 'asc' | 'desc'
            const toggleSort = (id: string) => {
              const key = sortKey(id)
              if (!key) return
              let dir: 'asc' | 'desc' = 'asc'
              if (currentKey === key) dir = currentDir === 'asc' ? 'desc' : 'asc'
              else dir = key === 'payment_date' ? 'desc' : 'asc'
              setSort(`${key}:${dir}`)
              setPage(1)
            }
            return (
              <>               
                <div className={`grid ${gridCls} gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b`}>
                  {visible.map((c) => {
                    const key = sortKey(c.id)
                    const active = key && currentKey === key
                    return (
                      <div key={c.id} className={c.id === 'amount' ? 'text-center' : ''}>
                        <div className={`inline-flex items-center gap-1 ${c.id === 'amount' ? 'justify-center' : ''}`}>
                          <span>{c.label}</span>
                          {c.sortable && (
                            <button className="inline-flex items-center" onClick={() => toggleSort(c.id)} aria-label="Sort">
                              {!active && <ChevronsUpDown className="h-4 w-4" />}
                              {active && currentDir === 'asc' && <ArrowUp className="h-4 w-4" />}
                              {active && currentDir === 'desc' && <ArrowDown className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Rows */}
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No payments</div>
                ) : (
                  items.map((r, idx) => {
                    return (
                      <div key={r.id || idx} className={`grid ${gridCls} gap-2 px-3 py-2 border-b text-sm cursor-pointer hover:bg-muted/50`} onClick={() => { setViewRow(r); setViewOpen(true) }}>
                        {visible.map(c => {
                        if (c.id === 'projectId') return <div key={c.id} className="whitespace-nowrap md:truncate" title={String(r.kimai_project_id)}>{r.kimai_project_id}</div>
                        if (c.id === 'projectName') return <div key={c.id} className="whitespace-nowrap md:truncate" title={r.project_name || ''}>{r.project_name || '-'}</div>
                          if (c.id === 'amount') return <div key={c.id} className="flex justify-center"><Amount value={r.amount} widthCh={amountWidthCh} /></div>
                        if (c.id === 'paymentDate') return <div key={c.id} className="whitespace-nowrap">{String(r.payment_date).slice(0, 10)}</div>
                        if (c.id === 'notes') return <div key={c.id} className="whitespace-nowrap md:truncate" title={r.notes || ''}>{r.notes || ''}</div>
                        if (c.id === 'createdBy') return <div key={c.id} className="whitespace-nowrap md:truncate" title={r.created_by_display || ''}>{r.created_by_display || ''}</div>
                          return <div key={c.id}></div>
                        })}
                      </div>
                    )
                  })
                )}
              </>
            )
          })()}
        </div>
      </div>

      <PaymentDialog open={createOpen} onOpenChange={setCreateOpen} defaultKimaiId={createKimaiId ?? undefined} onSaved={() => load()} />

      {/* View Payment Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
            <DialogDescription>Payment details</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{viewRow?.project_name || '-'}</span></div>
            <div><span className="text-muted-foreground">Amount:</span> <span className={`font-medium ${Number(viewRow?.amount || 0) > 0 ? 'text-green-600' : Number(viewRow?.amount || 0) < 0 ? 'text-red-600' : ''}`}>{viewRow ? Number(viewRow.amount).toFixed(2) : ''}</span></div>
            <div><span className="text-muted-foreground">Date:</span> <span>{viewRow?.payment_date ? formatDateDDMMYYYY(viewRow.payment_date) : ''}</span></div>
            {viewRow?.created_by_display && <div><span className="text-muted-foreground">Created By:</span> <span>{viewRow.created_by_display}</span></div>}
            <div><span className="text-muted-foreground">Created At:</span> <span>{viewRow?.created_at ? formatLocalPopoverYYYY(viewRow.created_at) : ''}</span></div>
            {viewRow?.notes && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Notes</div>
                <Textarea readOnly value={viewRow?.notes || ''} className="min-h-[80px]" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  )
}
