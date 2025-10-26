import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PaymentDialog } from '@/components/PaymentDialog'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronsUpDown, ArrowUp, ArrowDown, Columns as ColumnsIcon, ChevronDown, Plus, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

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
    } catch {}
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
    try { localStorage.setItem('payments:cols', JSON.stringify(Array.from(visibleCols))) } catch {}
  }, [visibleCols])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('payments:cols')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length) setVisibleCols(new Set(arr))
      }
    } catch {}
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
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold">Payments</div>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search project name/comment/notes…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load({ q: (e.target as HTMLInputElement).value }) } }} className="max-w-xs" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon className="h-4 w-4" />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
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
      <div className="border rounded">
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
              <div className={`grid ${gridCls} gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b sticky top-16 z-10`}>
                {visible.map((c) => {
                  const key = sortKey(c.id)
                  const active = key && currentKey === key
                  return (
                    <div key={c.id}>
                      <div className="inline-flex items-center gap-1">
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
                        if (c.id === 'projectId') return <div key={c.id} className="truncate" title={String(r.kimai_project_id)}>{r.kimai_project_id}</div>
                        if (c.id === 'projectName') return <div key={c.id} className="truncate" title={r.project_name || ''}>{r.project_name || '-'}</div>
                        if (c.id === 'amount') return <div key={c.id}>{Number(r.amount).toFixed(2)}</div>
                        if (c.id === 'paymentDate') return <div key={c.id}>{String(r.payment_date).slice(0, 10)}</div>
                        if (c.id === 'notes') return <div key={c.id} className="truncate" title={r.notes || ''}>{r.notes || ''}</div>
                        if (c.id === 'createdBy') return <div key={c.id} className="truncate" title={r.created_by_display || ''}>{r.created_by_display || ''}</div>
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

      <PaymentDialog open={createOpen} onOpenChange={setCreateOpen} defaultKimaiId={createKimaiId ?? undefined} onSaved={() => load()} />

      {/* View Payment Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
            <DialogDescription>Payment details</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{viewRow?.kimai_project_id}</span> — {viewRow?.project_name || '-'}</div>
            <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{viewRow ? Number(viewRow.amount).toFixed(2) : ''}</span></div>
            <div><span className="text-muted-foreground">Date:</span> <span>{viewRow?.payment_date?.slice(0,10) || ''}</span></div>
            {viewRow?.created_by_display && <div><span className="text-muted-foreground">Created By:</span> <span>{viewRow.created_by_display}</span></div>}
            <div><span className="text-muted-foreground">Created At:</span> <span>{viewRow?.created_at || ''}</span></div>
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
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
        <div className="flex items-center gap-8">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="payments-rows-per-page" className="text-sm font-medium">Rows per page</Label>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger size="sm" className="w-20" id="payments-rows-per-page">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPage(Math.max(1, Math.ceil(total / pageSize)))}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
