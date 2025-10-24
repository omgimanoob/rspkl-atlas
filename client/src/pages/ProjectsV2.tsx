import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export function ProjectsV2({ me }: { me?: { email: string; roles: string[] } }) {
  const [includeKimai, setIncludeKimai] = useState(true)
  const [includeAtlas, setIncludeAtlas] = useState(true)
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false)
  const [sourceDraft, setSourceDraft] = useState<{ kimai: boolean; atlas: boolean }>({ kimai: true, atlas: true })
  const [q, setQ] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<'updatedAt:desc' | 'displayName:asc' | 'displayName:desc'>('updatedAt:desc')
  const [statusFilter, setStatusFilter] = useState<Set<number> | null>(null)
  const [statusDraft, setStatusDraft] = useState<Set<number>>(new Set())
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [counts, setCounts] = useState<{ kimai: number; atlas: number } | null>(null)
  const isAdmin = !!me?.roles?.includes('admins')
  const canProspective = isAdmin || me?.roles?.some(r => ['hr','directors'].includes(r))
  const canOverrides = isAdmin || me?.roles?.some(r => ['hr','directors'].includes(r))
  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createStatusId, setCreateStatusId] = useState<number | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [statuses, setStatuses] = useState<Array<{ id: number; name: string }>>([])

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
  const [saving, setSaving] = useState(false)

  // Persist preferences
  useEffect(() => {
    try {
      const pref = { includeKimai, includeAtlas, sort, pageSize }
      localStorage.setItem('pv2:prefs', JSON.stringify(pref))
    } catch {}
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
    } catch {}
  }, [])

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
  const bothSourcesSelected = sourceDraft.kimai && sourceDraft.atlas

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
        setStatuses(list.filter(s => Number(s.is_active) === 1).map(s => ({ id: s.id, name: s.name })))
      } catch { setStatuses([]) }
    })()
  }, [])

  const filtered = useMemo(() => items, [items])

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold">Projects v2</div>
          <DropdownMenu open={sourceMenuOpen} onOpenChange={(open) => {
            setSourceMenuOpen(open)
            if (open) setSourceDraft({ kimai: includeKimai, atlas: includeAtlas })
          }}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Sources</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Include</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sourceDraft.kimai}
                onSelect={event => event.preventDefault()}
                onCheckedChange={v => setSourceDraft(d => ({ ...d, kimai: Boolean(v) }))}
              >
                Kimai
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sourceDraft.atlas}
                onSelect={event => event.preventDefault()}
                onCheckedChange={v => setSourceDraft(d => ({ ...d, atlas: Boolean(v) }))}
              >
                Prospective (Atlas)
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSourceDraft({ kimai: true, atlas: true })} disabled={bothSourcesSelected}>Select both</Button>
                <Button size="sm" onClick={async () => {
                  setIncludeKimai(sourceDraft.kimai)
                  setIncludeAtlas(sourceDraft.atlas)
                  setPage(1)
                  setSourceMenuOpen(false)
                  const nextInclude: Array<'kimai' | 'atlas'> = []
                  if (sourceDraft.kimai) nextInclude.push('kimai')
                  if (sourceDraft.atlas) nextInclude.push('atlas')
                  await load({
                    statusIds: statusFilterState.ids,
                    statusNull: statusFilterState.wantsNull,
                    include: nextInclude,
                  })
                }}>Apply</Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search name…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }} className="max-w-xs" />
          <Select value={sort} onValueChange={(v) => { setSort(v as any); setPage(1) }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt:desc">Updated (newest)</SelectItem>
              <SelectItem value="displayName:asc">Name (A→Z)</SelectItem>
              <SelectItem value="displayName:desc">Name (Z→A)</SelectItem>
            </SelectContent>
          </Select>
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
              <Button variant="outline" size="sm">Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statuses.length === 0 && <div className="px-2 py-1 text-xs text-gray-500">No statuses</div>}
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
          <Button size="sm" onClick={() => { setPage(1); load() }} disabled={loading}>{loading ? 'Loading…' : 'Search'}</Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!canProspective}>New Prospective</Button>
        </div>
      </div>
      <div className="border rounded">
        {counts && (
          <div className="px-3 py-2 text-xs text-gray-600 flex gap-4 border-b bg-gray-50">
            <div>Kimai: <span className="font-semibold">{counts.kimai}</span></div>
            <div>Prospective: <span className="font-semibold">{counts.atlas}</span></div>
            <div>Total: <span className="font-semibold">{total}</span></div>
          </div>
        )}
        <div className="grid grid-cols-7 gap-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b">
          <div>Origin</div>
          <div>ID</div>
          <div>Name</div>
          <div>Status</div>
          <div>Prospective</div>
          <div>Updated</div>
          <div className="text-right">Actions</div>
        </div>
        {filtered.map((r, idx) => (
          <div key={idx} className="grid grid-cols-7 gap-2 px-3 py-2 text-sm border-b last:border-b-0">
            <div>{r.origin === 'atlas' ? 'Prospective' : 'Kimai'}</div>
            <div>{r.id}</div>
            <div>{r.displayName}</div>
            <div>
              {r.statusName ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 border border-gray-200">{r.statusName}</span> : '-'}
            </div>
            <div>{r.isProspective ? 'Yes' : 'No'}</div>
            <div>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}</div>
            <div className="flex items-center justify-end gap-2">
              {r.origin === 'atlas' ? (
                <>
                  <Button size="sm" variant="outline" disabled={!canProspective} onClick={() => { setEditAtlasRow(r); setEditAtlasName(r.displayName || ''); setEditAtlasStatusId(r.statusId ?? null); setEditAtlasNotes(''); setEditAtlasOpen(true) }}>Edit</Button>
                  <Button size="sm" disabled={!canProspective} onClick={() => { setLinkRow(r); setLinkKimaiId(''); setLinkOpen(true) }}>Link</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" disabled={!canOverrides} onClick={() => { setEditKimaiRow(r); setEditKimaiStatusId(r.statusId ?? null); setEditKimaiMoney(''); setEditKimaiOpen(true) }}>Overrides</Button>
              )}
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="px-3 py-8 text-center text-sm text-gray-500">No projects</div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm text-gray-600">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className="h-8 w-[120px]"><SelectValue placeholder="Rows" /></SelectTrigger>
            <SelectContent>
              {[10,20,50,100].map(n => <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>Prev</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / pageSize)}>Next</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, Math.ceil(total / pageSize)))} disabled={page >= Math.ceil(total / pageSize)}>Last</Button>
          </div>
        </div>
      </div>

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
              <div className="text-sm text-gray-600">Name</div>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} disabled={saving} placeholder="Enter name" />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Status</div>
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
              <div className="text-sm text-gray-600">Notes</div>
              <Input value={createNotes} onChange={e => setCreateNotes(e.target.value)} disabled={saving} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
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
              <div className="text-sm text-gray-600">Name</div>
              <Input value={editAtlasName} onChange={e => setEditAtlasName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Status</div>
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
              <div className="text-sm text-gray-600">Notes</div>
              <Input value={editAtlasNotes} onChange={e => setEditAtlasNotes(e.target.value)} disabled={saving} />
            </div>
          </div>
          <DialogFooter>
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
              <div className="text-sm text-gray-600">Kimai Project ID</div>
              <Input value={linkKimaiId} onChange={e => setLinkKimaiId(e.target.value)} placeholder="e.g., 1234" disabled={saving} />
            </div>
          </div>
          <DialogFooter>
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
      <Dialog open={editKimaiOpen} onOpenChange={setEditKimaiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Overrides</DialogTitle>
            <DialogDescription>Update status and money collected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Status</div>
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
              <div className="text-sm text-gray-600">Money Collected</div>
              <Input value={editKimaiMoney} onChange={e => setEditKimaiMoney(e.target.value)} placeholder="0.00" disabled={saving} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditKimaiOpen(false)} disabled={saving}>Cancel</Button>
            <Button disabled={saving || !canOverrides} onClick={async () => {
              if (!editKimaiRow) return
              const payload: any = {}
              if (editKimaiStatusId !== undefined) payload.status_id = editKimaiStatusId
              if (editKimaiMoney.trim() !== '') payload.money_collected = Number(parseFloat(editKimaiMoney))
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
    </div>
  )
}
