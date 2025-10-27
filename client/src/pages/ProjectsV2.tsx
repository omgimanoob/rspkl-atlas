import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { ProjectStatusBadge } from '@/components/ProjectStatusBadge'
import { Amount } from '@/components/Amount'
import { PaymentDialog } from '@/components/PaymentDialog'
import { CheckCircle2, Loader2, MoreVertical, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Plus, ChevronsUpDown, ArrowUp, ArrowDown, Columns as ColumnsIcon, ChevronDown } from 'lucide-react'
import { formatLocalPopover } from '@/lib/datetime'
import { TablePagination } from '@/components/TablePagination'

const defaultVisibleColumns = [
  // 'origin',
  'name',
  'notes',
  'status',
  'money',
  // 'prospective',
  'updated',
] as const

export function ProjectsV2({ me }: { me?: { email: string; roles: string[] } }) {
  const [includeKimai, setIncludeKimai] = useState(true)
  const [includeAtlas, setIncludeAtlas] = useState(true)
  const [originMenuOpen, setOriginMenuOpen] = useState(false)
  const [originDraft, setOriginDraft] = useState<{ kimai: boolean; atlas: boolean }>({ kimai: true, atlas: true })
  const [q, setQ] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<string>('updatedAt:desc')
  const [statusFilter, setStatusFilter] = useState<Set<number> | null>(null)
  const [statusDraft, setStatusDraft] = useState<Set<number>>(new Set())
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [counts, setCounts] = useState<{ kimai: number; atlas: number } | null>(null)
  // Columns visibility
  const allColumns = useMemo(() => ([
    { id: 'origin', label: 'Origin', sortable: false as const },
    { id: 'id', label: 'ID', sortable: true as const, sortKey: 'id' },
    { id: 'name', label: 'Name', sortable: true as const, sortKey: 'displayName' },
    { id: 'notes', label: 'Notes', sortable: true as const, sortKey: 'notes' },
    { id: 'status', label: 'Status', sortable: true as const, sortKey: 'statusName' },
    { id: 'money', label: 'Money Collected', sortable: true as const, sortKey: 'moneyCollected' },
    { id: 'prospective', label: 'Prospective', sortable: true as const, sortKey: 'isProspective' },
    { id: 'updated', label: 'Updated', sortable: true as const, sortKey: 'updatedAt' },
    { id: 'actions', label: 'Actions', sortable: false as const },
  ]), [])
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('pv2:cols')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) return new Set(arr.filter((x: any) => typeof x === 'string'))
      }
    } catch { }
    return new Set(defaultVisibleColumns)
  })
  const isAdmin = !!me?.roles?.includes('admins')
  const canProspective = isAdmin || me?.roles?.some(r => ['hr', 'directors'].includes(r))
  const canOverrides = isAdmin || me?.roles?.some(r => ['hr', 'directors'].includes(r))
  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createStatusId, setCreateStatusId] = useState<number | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [statuses, setStatuses] = useState<Array<{ id: number; name: string; color?: string | null }>>([])

  // Dialog states
  const [editAtlasOpen, setEditAtlasOpen] = useState(false)
  const [editAtlasRow, setEditAtlasRow] = useState<any | null>(null)
  const [editAtlasName, setEditAtlasName] = useState('')
  const [editAtlasStatusId, setEditAtlasStatusId] = useState<number | null>(null)
  const [editAtlasNotes, setEditAtlasNotes] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkRow, setLinkRow] = useState<any | null>(null)
  const [linkKimaiId, setLinkKimaiId] = useState('')
  const [editKimaiOpen, setEditKimaiOpen] = useState(false)
  const [editKimaiRow, setEditKimaiRow] = useState<any | null>(null)
  const [editKimaiStatusId, setEditKimaiStatusId] = useState<number | null>(null)
  const [editKimaiMoney, setEditKimaiMoney] = useState('')
  const [editKimaiNotes, setEditKimaiNotes] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [payKimaiId, setPayKimaiId] = useState<number | null>(null)
  const [recalcLoading, setRecalcLoading] = useState<Set<number>>(new Set())
  const [dlgRecalcLoading, setDlgRecalcLoading] = useState(false)
  // Inline Enter Payment (details) state
  const [enterPayAmount, setEnterPayAmount] = useState('')
  const [enterPayDate, setEnterPayDate] = useState(() => {
    const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`
  })
  const [enterPaySaving, setEnterPaySaving] = useState(false)

  function handleRowClick(r: any) {
    if (r.origin === 'atlas') {
      if (!canProspective) return
      setEditAtlasRow(r)
      setEditAtlasName(r.displayName || '')
      setEditAtlasStatusId(r.statusId ?? null)
      setEditAtlasNotes(r.notes || '')
      setEditAtlasOpen(true)
    } else {
      if (!canOverrides) return
      setEditKimaiRow(r)
      setEditKimaiStatusId(r.statusId ?? null)
      setEditKimaiMoney(r.moneyCollected != null ? Number(r.moneyCollected).toFixed(2) : '')
      setEditKimaiNotes(r.notes || '')
      setEditKimaiOpen(true)
    }
  }
  const [saving, setSaving] = useState(false)

  // Persist preferences
  useEffect(() => {
    try {
      const pref = { includeKimai, includeAtlas, sort, pageSize }
      localStorage.setItem('pv2:prefs', JSON.stringify(pref))
    } catch { }
  }, [includeKimai, includeAtlas, sort, pageSize])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pv2:prefs')
      if (raw) {
        const pref = JSON.parse(raw)
        if (typeof pref?.includeKimai === 'boolean') setIncludeKimai(pref.includeKimai)
        if (typeof pref?.includeAtlas === 'boolean') setIncludeAtlas(pref.includeAtlas)
        if (typeof pref?.sort === 'string') setSort(pref.sort)
        if (typeof pref?.pageSize === 'number') setPageSize(pref.pageSize)
      }
      const rawCols = localStorage.getItem('pv2:cols')
      if (rawCols) {
        const arr = JSON.parse(rawCols)
        if (Array.isArray(arr)) setVisibleCols(new Set(arr.filter((x: any) => typeof x === 'string')))
      }
    } catch { }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('pv2:cols', JSON.stringify(Array.from(visibleCols))) } catch { }
  }, [visibleCols])

  const statusFilterKey = useMemo(() => {
    if (statusFilter === null) return '__all__'
    if (statusFilter.size === 0) return '__none__'
    return Array.from(statusFilter).sort((a, b) => a - b).join(',')
  }, [statusFilter])

  const statusFilterState = useMemo(() => {
    if (statusFilter === null) return { active: false, ids: undefined as number[] | undefined, wantsNull: false }
    if (statusFilter.size === 0) return { active: true, ids: undefined, wantsNull: true }
    return { active: true, ids: Array.from(statusFilter), wantsNull: false }
  }, [statusFilter])

  const statusIdsAll = useMemo(() => statuses.map(s => s.id), [statuses])
  const allStatusesSelected = statuses.length > 0 && statusDraft.size === statuses.length
  const noStatusesSelected = statusDraft.size === 0
  const bothOriginsSelected = originDraft.kimai && originDraft.atlas

  async function load(input?: { statusIds?: number[]; statusNull?: boolean; include?: Array<'kimai' | 'atlas'> }) {
    setLoading(true)
    try {
      const include: Array<'kimai' | 'atlas'> = input?.include
        ? [...input.include]
        : (() => {
          const arr: Array<'kimai' | 'atlas'> = []
          if (includeKimai) arr.push('kimai')
          if (includeAtlas) arr.push('atlas')
          return arr
        })()
      const wantsNull = input?.statusNull ?? statusFilterState.wantsNull
      const statusIds = input?.statusIds ?? statusFilterState.ids
      const res = await api.v2.projects({
        include,
        q,
        page,
        pageSize,
        sort,
        statusIds,
        statusNull: wantsNull,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
      if (res.counts) setCounts(res.counts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [includeKimai, includeAtlas, page, pageSize, sort, statusFilterKey])
  useEffect(() => {
    (async () => {
      try {
        const list = await api.v2.listStatuses()
        setStatuses(list.filter(s => Number(s.is_active) === 1).map(s => ({ id: s.id, name: s.name, color: (s as any).color || null })))
      } catch { setStatuses([]) }
    })()
  }, [])

  const filtered = useMemo(() => items, [items])
  const moneyWidthCh = useMemo(() => {
    try {
      const lens = items.map((r: any) => {
        const n = Number(r.moneyCollected || 0)
        const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        return s.length + (n < 0 ? 1 : 0)
      })
      return Math.max(8, ...lens)
    } catch { return 8 }
  }, [items])

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 hidden sm:inline">
          <div className="text-base font-semibold">Projects</div>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search name…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }} className="max-w-xs" />
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
              {allColumns.filter(c => c.id !== 'actions').map(c => (
                <DropdownMenuCheckboxItem key={c.id} checked={visibleCols.has(c.id)} onCheckedChange={(v) => {
                  const next = new Set(visibleCols)
                  if (v) next.add(c.id); else next.delete(c.id)
                  if (next.size === 0) return // keep at least one
                  setVisibleCols(next)
                }}>{c.label}</DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setVisibleCols(new Set(defaultVisibleColumns))}>Reset to default</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} disabled={!canProspective}>
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline">New Prospective</span>
            <span className="sr-only lg:hidden">New Prospective</span>
          </Button>
        </div>
      </div>
      <div className="border rounded overflow-x-auto">
        {/* <div className="sm:min-w-[960px] md:w-full"> */}
        <div className="w-[800px] md:w-full relative">

          {counts && (
            <div className="px-3 py-2 text-xs text-muted-foreground flex gap-4 border-b bg-muted">
              <div>Kimai: <span className="font-semibold">{counts.kimai}</span></div>
              <div>Prospective: <span className="font-semibold">{counts.atlas}</span></div>
              <div>Total: <span className="font-semibold">{total}</span></div>
            </div>
          )}
          {(() => {
            const visible = allColumns.filter(c => c.id === 'actions' || visibleCols.has(c.id))
            const count = visible.length
            const gridCls = count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : count === 4 ? 'grid-cols-4' : count === 5 ? 'grid-cols-5' : count === 6 ? 'grid-cols-6' : count === 7 ? 'grid-cols-7' : 'grid-cols-8'
            const sortKey = (id: string) => (allColumns.find(c => c.id === id) as any)?.sortKey as string | undefined
            const currentKey = sort.split(':')[0]
            const currentDir = (sort.split(':')[1] || 'asc') as 'asc' | 'desc'
            const toggleSort = (id: string) => {
              const key = sortKey(id)
              if (!key) return
              let dir: 'asc' | 'desc' = 'asc'
              if (currentKey === key) dir = currentDir === 'asc' ? 'desc' : 'asc'
              else dir = key === 'updatedAt' ? 'desc' : 'asc'
              setSort(`${key}:${dir}`)
              setPage(1)
            }
            return (
              <div className={`grid ${gridCls} gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b md:z-10`}>
                {visible.map((c) => {
                  const key = sortKey(c.id)
                  const active = key && currentKey === key
                  const isActions = c.id === 'actions'
                  const showFilterTrigger = c.id === 'status' || c.id === 'origin'
                  return (
                    <div key={c.id} className={`${isActions ? 'text-right' : ''} ${c.id === 'money' ? 'text-center' : ''}`}>
                      <div className={`inline-flex items-center gap-1 ${c.id === 'money' ? 'justify-center' : ''}`}>
                        {showFilterTrigger && c.id === 'origin' && (
                          <DropdownMenu open={originMenuOpen} onOpenChange={(open) => {
                            setOriginMenuOpen(open)
                            if (open) setOriginDraft({ kimai: includeKimai, atlas: includeAtlas })
                          }}>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="hover:underline">{c.label}</button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuLabel>Include</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuCheckboxItem
                                checked={originDraft.kimai}
                                onSelect={event => event.preventDefault()}
                                onCheckedChange={v => setOriginDraft(d => ({ ...d, kimai: Boolean(v) }))}
                              >
                                Kimai
                              </DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem
                                checked={originDraft.atlas}
                                onSelect={event => event.preventDefault()}
                                onCheckedChange={v => setOriginDraft(d => ({ ...d, atlas: Boolean(v) }))}
                              >
                                Prospective (Atlas)
                              </DropdownMenuCheckboxItem>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-2 flex items-center justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setOriginDraft({ kimai: true, atlas: true })} disabled={bothOriginsSelected}>Select both</Button>
                                <Button size="sm" onClick={async () => {
                                  setIncludeKimai(originDraft.kimai)
                                  setIncludeAtlas(originDraft.atlas)
                                  setPage(1)
                                  setOriginMenuOpen(false)
                                  const nextInclude: Array<'kimai' | 'atlas'> = []
                                  if (originDraft.kimai) nextInclude.push('kimai')
                                  if (originDraft.atlas) nextInclude.push('atlas')
                                  await load({
                                    statusIds: statusFilterState.ids,
                                    statusNull: statusFilterState.wantsNull,
                                    include: nextInclude,
                                  })
                                }}>Apply</Button>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {showFilterTrigger && c.id === 'status' && (
                          <DropdownMenu open={statusMenuOpen} onOpenChange={(open) => {
                            setStatusMenuOpen(open)
                            if (open) {
                              if (statusFilter === null) {
                                setStatusDraft(new Set(statusIdsAll))
                              } else if (statusFilter.size) {
                                setStatusDraft(new Set(statusFilter))
                              } else {
                                setStatusDraft(new Set())
                              }
                            }
                          }}>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="hover:underline">{c.label}</button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {statuses.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No statuses</div>}
                              {statuses.map(s => (
                                <DropdownMenuCheckboxItem
                                  key={s.id}
                                  checked={statusDraft.has(s.id)}
                                  onCheckedChange={(v) => {
                                    const next = new Set(statusDraft)
                                    if (v) next.add(s.id); else next.delete(s.id)
                                    setStatusDraft(next)
                                  }}
                                  onSelect={(event) => event.preventDefault()}
                                >
                                  <div className="flex w-full justify-between"><span>{s.name || `#${s.id}`}</span></div>
                                </DropdownMenuCheckboxItem>
                              ))}
                              {statuses.length > 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  <div className="px-2 py-2 flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setStatusDraft(new Set(statusIdsAll))}
                                      disabled={allStatusesSelected}
                                    >Select all</Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setStatusDraft(new Set())}
                                      disabled={noStatusesSelected}
                                    >Clear all</Button>
                                    <Button size="sm" onClick={async () => {
                                      const next = new Set(statusDraft)
                                      let nextFilter: Set<number> | null = next
                                      let statusIdsArg: number[] | undefined
                                      let statusNullArg = false
                                      if (statuses.length && next.size === statuses.length) {
                                        nextFilter = null
                                        statusIdsArg = undefined
                                      } else if (next.size === 0) {
                                        nextFilter = new Set()
                                        statusNullArg = true
                                      } else {
                                        statusIdsArg = Array.from(next)
                                      }
                                      setStatusFilter(nextFilter)
                                      setPage(1)
                                      setStatusMenuOpen(false)
                                      await load({ statusIds: statusIdsArg, statusNull: statusNullArg })
                                    }}>Apply</Button>
                                  </div>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {!showFilterTrigger && <span>{c.label}</span>}
                        {key && (
                          <button
                            type="button"
                            aria-label={`Sort by ${c.label}`}
                            onClick={() => toggleSort(c.id)}
                            className="inline-flex items-center"
                          >
                            {!active && <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />}
                            {active && (currentDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          {filtered.map((r, idx) => {
            const visible = allColumns.filter(c => c.id === 'actions' || visibleCols.has(c.id))
            const count = visible.length
            const gridCls = count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : count === 4 ? 'grid-cols-4' : count === 5 ? 'grid-cols-5' : count === 6 ? 'grid-cols-6' : count === 7 ? 'grid-cols-7' : 'grid-cols-8'
            return (
              <div
                key={idx}
                className={`grid ${gridCls} gap-2 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/50 cursor-pointer`}
                onClick={() => handleRowClick(r)}
              >
                {visible.map((c) => {
                  if (c.id === 'origin') return <div key={c.id}>{r.origin === 'atlas' ? 'Prospective' : 'Kimai'}</div>
                  if (c.id === 'id') return <div key={c.id}>{r.id}</div>
                  if (c.id === 'name') return <div key={c.id} className="whitespace-nowrap truncate" title={r.displayName}>{r.displayName}</div>
                  if (c.id === 'status') return (
                    <div key={c.id}>
                      {r.statusId != null ? (
                        <ProjectStatusBadge name={r.statusName} color={statuses.find(s => s.id === r.statusId)?.color || undefined} />
                      ) : '-'}
                    </div>
                  )
                  if (c.id === 'notes') return <div key={c.id} className="whitespace-nowrap truncate" title={r.notes || ''}>{r.notes || '-'}</div>
                  if (c.id === 'money') {
                    const pid = r.kimaiId || r.id
                    const loadingAmt = recalcLoading.has(pid)
                    return <div key={c.id} className="flex justify-center">{r.moneyCollected != null ? <Amount value={r.moneyCollected} loading={loadingAmt} widthCh={moneyWidthCh} /> : ''}</div>
                  }
                  if (c.id === 'prospective') return <div key={c.id}>{r.isProspective ? 'Yes' : 'No'}</div>
                  if (c.id === 'updated') return <div key={c.id} className="whitespace-nowrap">{formatLocalPopover(r.updatedAt)}</div>
                  if (c.id === 'actions') return (
                    <div key={c.id} className="flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="data-[state=open]:bg-muted text-muted-foreground"
                            aria-label="Open row actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                          {r.origin === 'atlas' ? (
                            <>
                              <DropdownMenuItem
                                disabled={!canProspective}
                                onClick={() => { setEditAtlasRow(r); setEditAtlasName(r.displayName || ''); setEditAtlasStatusId(r.statusId ?? null); setEditAtlasNotes(r.notes || ''); setEditAtlasOpen(true) }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canProspective}
                                onClick={() => { setLinkRow(r); setLinkKimaiId(''); setLinkOpen(true) }}
                              >
                                Link
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem
                                disabled={!canOverrides}
                                onClick={() => { setEditKimaiRow(r); setEditKimaiStatusId(r.statusId ?? null); setEditKimaiMoney(r.moneyCollected != null ? Number(r.moneyCollected).toFixed(2) : ''); setEditKimaiNotes(r.notes || ''); setEditKimaiOpen(true) }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canOverrides}
                                onClick={() => { setPayKimaiId(r.kimaiId || r.id); setPayOpen(true) }}
                              >
                                Enter Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canOverrides}
                                onClick={async () => {
                                  const pid = r.kimaiId || r.id
                                  setRecalcLoading(prev => { const next = new Set(prev); next.add(pid); return next })
                                  try {
                                    await api.payments.recalc(pid)
                                    toast.success('Recalculated')
                                    await load()
                                  } catch { toast.error('Failed to recalculate') }
                                  finally { setRecalcLoading(prev => { const next = new Set(prev); next.delete(pid); return next }) }
                                }}
                              >
                                Recalculate
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                  return <div key={c.id} />
                })}
              </div>
            )
          })}
          {!filtered.length && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No projects</div>
          )}
        </div>
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />

      {/* Edit Prospective Dialog */}
      {/* Create Prospective Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Prospective Project</DialogTitle>
            <DialogDescription>Create an Atlas-native project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Name</div>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} disabled={saving} placeholder="Enter name" />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Status</div>
              <Select value={createStatusId != null ? String(createStatusId) : ''} onValueChange={v => setCreateStatusId(v ? Number(v) : null)}>
                <SelectTrigger disabled={saving || statuses.length === 0}>
                  <SelectValue placeholder={statuses.length ? 'Select status' : 'Statuses unavailable'} />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (<SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Notes</div>
              <Textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} disabled={saving} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter className="flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button disabled={saving || !canProspective} onClick={async () => {
              const name = createName.trim()
              if (!name) { toast.error('Enter a name'); return }
              try {
                setSaving(true)
                await api.v2.createProspective({ name, status_id: createStatusId || undefined, notes: createNotes || undefined })
                toast.success('Prospective created')
                setCreateOpen(false)
                setCreateName(''); setCreateStatusId(null); setCreateNotes('')
                setPage(1)
                await load()
              } catch (e: any) {
                const reason = (e?.payload && e.payload.reason) || ''
                toast.error(reason ? `Failed: ${reason}` : 'Failed to create prospective')
              } finally { setSaving(false) }
            }}>{saving ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editAtlasOpen} onOpenChange={setEditAtlasOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Prospective</DialogTitle>
            <DialogDescription>Update name, status and notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Name</div>
              <Input value={editAtlasName} onChange={e => setEditAtlasName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Status</div>
              <Select value={editAtlasStatusId != null ? String(editAtlasStatusId) : ''} onValueChange={v => setEditAtlasStatusId(v ? Number(v) : null)}>
                <SelectTrigger disabled={saving || statuses.length === 0}>
                  <SelectValue placeholder={statuses.length ? 'Select status' : 'Statuses unavailable'} />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (<SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Notes</div>
              <Textarea value={editAtlasNotes} onChange={e => setEditAtlasNotes(e.target.value)} disabled={saving} placeholder="Add any relevant notes…" />
            </div>
          </div>
          <DialogFooter className="flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditAtlasOpen(false)} disabled={saving}>Cancel</Button>
            <Button disabled={saving || !canProspective} onClick={async () => {
              if (!editAtlasRow) return
              try {
                setSaving(true)
                await api.v2.updateProspective(editAtlasRow.atlasId, { name: editAtlasName, status_id: editAtlasStatusId, notes: editAtlasNotes })
                toast.success('Prospective updated')
                setEditAtlasOpen(false)
                await load()
              } catch (e: any) {
                const reason = (e?.payload && e.payload.reason) || ''
                toast.error(reason ? `Failed: ${reason}` : 'Failed to update prospective')
              } finally { setSaving(false) }
            }}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Prospective Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Kimai</DialogTitle>
            <DialogDescription>Enter a valid Kimai project id to link this Prospective project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Kimai Project ID</div>
              <Input value={linkKimaiId} onChange={e => setLinkKimaiId(e.target.value)} placeholder="e.g., 1234" disabled={saving} />
            </div>
          </div>
          <DialogFooter className="flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setLinkOpen(false)} disabled={saving}>Cancel</Button>
            <Button disabled={saving || !canProspective} onClick={async () => {
              if (!linkRow) return
              const id = Number(linkKimaiId)
              if (!Number.isFinite(id)) { toast.error('Enter a valid numeric Kimai id'); return }
              try {
                setSaving(true)
                await api.v2.linkProspective(linkRow.atlasId, id)
                toast.success('Linked to Kimai')
                setLinkOpen(false)
                await load()
              } catch (e: any) {
                const reason = (e?.payload && e.payload.reason) || ''
                const map: any = { unknown_kimai_project: 'Kimai id not found', override_exists_for_project: 'Override already exists for this Kimai project', already_linked: 'Prospective already linked' }
                toast.error(map[reason] || (reason ? `Failed: ${reason}` : 'Failed to link'))
              } finally { setSaving(false) }
            }}>{saving ? 'Linking…' : 'Link'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Kimai Overrides Dialog */}
      <Dialog open={editKimaiOpen} onOpenChange={(open) => { if (!open) { setEnterPayAmount('') } setEditKimaiOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Overrides</DialogTitle>
            <DialogDescription>Update status and money collected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Status</div>
              <Select value={editKimaiStatusId != null ? String(editKimaiStatusId) : ''} onValueChange={v => setEditKimaiStatusId(v ? Number(v) : null)}>
                <SelectTrigger disabled={saving || statuses.length === 0}>
                  <SelectValue placeholder={statuses.length ? 'Select status' : 'Statuses unavailable'} />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (<SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Notes</div>
              <Textarea value={editKimaiNotes} onChange={e => setEditKimaiNotes(e.target.value)} placeholder="Optional" disabled={saving} />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Money Collected (read-only)</div>
              <div className="flex items-center gap-2">
                <Input value={editKimaiMoney} readOnly disabled placeholder="0.00" className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Recalculate"
                  aria-label="Recalculate"
                  disabled={dlgRecalcLoading || enterPaySaving}
                  onClick={async () => {
                    if (!editKimaiRow) return;
                    try {
                      setDlgRecalcLoading(true)
                      setEditKimaiMoney('')
                      const resp = await api.payments.recalc(editKimaiRow.kimaiId || editKimaiRow.id)
                      const val = Number(resp.money_collected || 0)
                      setEditKimaiMoney(val.toFixed(2))
                      setEditKimaiRow({ ...editKimaiRow, moneyCollected: val })
                      toast.success('Recalculated')
                      await load()
                    } catch {
                      toast.error('Failed to recalculate')
                    } finally {
                      setDlgRecalcLoading(false)
                    }
                  }}
                >
                  {dlgRecalcLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                  )}
                </Button>
              </div>
            </div>
            {/* Inline Enter Payment */}
            <details className="space-y-2">
              <summary className="text-sm text-muted-foreground cursor-pointer select-none">Enter Payment</summary>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <Input value={enterPayAmount} onChange={e => setEnterPayAmount(e.target.value)} placeholder="0.00" disabled={enterPaySaving} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Payment Date</div>
                  <Input type="date" value={enterPayDate} onChange={e => setEnterPayDate(e.target.value)} disabled={enterPaySaving} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  disabled={enterPaySaving || !Number.isFinite(Number(parseFloat(enterPayAmount))) || !enterPayDate}
                  onClick={async () => {
                    if (!editKimaiRow) return
                    const amt = Number(parseFloat(enterPayAmount))
                    if (!Number.isFinite(amt)) { toast.error('Enter a valid amount'); return }
                    if (!enterPayDate) { toast.error('Select a date'); return }
                    try {
                      setEnterPaySaving(true)
                      const resp = await api.payments.create({ kimai_project_id: editKimaiRow.kimaiId || editKimaiRow.id, amount: amt, payment_date: enterPayDate })
                      toast.success('Payment recorded')
                      // Reset and refresh values
                      setEnterPayAmount('')
                      const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); setEnterPayDate(`${y}-${m}-${day}`)
                      // Reflect updated total in dialog immediately
                      if (resp && typeof resp.money_collected !== 'undefined') {
                        const total = Number(resp.money_collected || 0)
                        setEditKimaiMoney(total.toFixed(2))
                        setEditKimaiRow({ ...editKimaiRow, moneyCollected: total })
                      }
                      await load()
                    } catch {
                      toast.error('Failed to create payment')
                    } finally {
                      setEnterPaySaving(false)
                    }
                  }}
                >
                  {enterPaySaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </details>
          </div>
          {editKimaiRow?.comment && (
            <details className="space-y-2">
              <summary className="text-sm text-muted-foreground cursor-pointer select-none">Kimai Comment</summary>
              <Textarea value={editKimaiRow.comment} readOnly disabled className="min-h-[80px]" />
            </details>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditKimaiOpen(false)} disabled={saving}>Cancel</Button>
            <Button disabled={saving || !canOverrides} onClick={async () => {
              if (!editKimaiRow) return
              const payload: any = {}
              if (editKimaiStatusId !== undefined) payload.status_id = editKimaiStatusId
              payload.notes = editKimaiNotes
              try {
                setSaving(true)
                await api.v2.updateKimaiOverrides(editKimaiRow.kimaiId || editKimaiRow.id, payload)
                toast.success('Overrides updated')
                setEditKimaiOpen(false)
                await load()
              } catch (e: any) {
                const reason = (e?.payload && e.payload.reason) || ''
                toast.error(reason ? `Failed: ${reason}` : 'Failed to update overrides')
              } finally { setSaving(false) }
            }}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} defaultKimaiId={payKimaiId ?? undefined} onSaved={() => load()} />
    </div>
  )
}
