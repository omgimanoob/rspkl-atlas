import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { formatLocalCompact } from '@/lib/datetime'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Columns3, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { validatePasswordClient } from '@/lib/password'
import { PasswordField } from '@/components/PasswordField'
import { useEffect as useEffectReact, useState as useStateReact } from 'react'

type UserRow = {
  id: number
  email: string
  display_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function AdminUsers({ currentUserId }: { currentUserId: number }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // Sort state (persisted)
  const STORAGE_KEY_SORT = 'admin.users.sort'
  const [sortKey, setSortKey] = useState<keyof UserRow>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SORT)
      if (raw) { const p = JSON.parse(raw); if (p?.key) return p.key }
    } catch {}
    return 'id'
  })
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SORT)
      if (raw) { const p = JSON.parse(raw); if (p?.dir) return p.dir }
    } catch {}
    return 'asc'
  })
  const [rows, setRows] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  // Roles state
  const [allRoles, setAllRoles] = useState<Array<{ code: string; name: string }>>([])
  const [editRoleNames, setEditRoleNames] = useState<Set<string>>(new Set())
  const [editRolesLoading, setEditRolesLoading] = useState(false)
  const [roleTogglePending, setRoleTogglePending] = useState<Set<string>>(new Set()) // key `${userId}:${role}`
  const [createSelectedRoles, setCreateSelectedRoles] = useState<Set<string>>(new Set())
  const allCols = ['id','email','display_name','roles','is_active','created_at','updated_at','actions'] as const
  const STORAGE_KEY = 'admin.users.colVis'
  const defaultVis: Record<string, boolean> = Object.fromEntries(allCols.map(c => [c, c !== 'id'])) as any
  const [colVis, setColVis] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // validate keys
        const out: Record<string, boolean> = { ...defaultVis }
        for (const k of allCols) {
          if (typeof parsed?.[k] === 'boolean') out[k] = parsed[k]
        }
        return out
      }
    } catch {}
    return { ...defaultVis }
  })

  const load = async () => {
    setLoading(true)
    const resp = await api.adminListUsers({ page, pageSize, search: q.trim() || undefined, sortKey, sortDir })
    setRows(resp.items)
    setTotal(resp.total)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortKey, sortDir])

  // Load roles for visible users to display inline
  useEffect(() => {
    (async () => {
      const next: Record<number, string[]> = {}
      await Promise.all(rows.map(async (r) => {
        try { next[r.id] = await api.adminListUserRoles(r.id) } catch { next[r.id] = [] }
      }))
      setUserRolesMap(next)
    })()
  }, [rows])

  // Load all roles once for role selectors
  useEffect(() => {
    (async () => {
      try {
        const roles = await api.adminListRoles()
        setAllRoles(roles.map(r => ({ code: r.code, name: r.name })))
      } catch {
        setAllRoles([])
      }
    })()
  }, [])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
  const visibleCount = useMemo(() => allCols.reduce((acc, c) => acc + (colVis[c] ? 1 : 0), 0), [colVis])

  // Persist column visibility

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colVis)) } catch {}
  }, [colVis])

  // Persist sort state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify({ key: sortKey, dir: sortDir })) } catch {}
  }, [sortKey, sortDir])

  // Create user modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [createPwd, setCreatePwd] = useState('')
  const [createActive, setCreateActive] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createErrEmail, setCreateErrEmail] = useState<string | null>(null)
  const [createErrPwd, setCreateErrPwd] = useState<string | null>(null)
  const [userRolesMap, setUserRolesMap] = useState<Record<number, string[]>>({})
  
  

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let av: any = a[sortKey]
      let bv: any = b[sortKey]
      if (sortKey === 'created_at' || sortKey === 'updated_at') {
        av = new Date(av).getTime(); bv = new Date(bv).getTime()
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggleSort = (key: keyof UserRow) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2">
          <Input placeholder="Search by email…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
          <Button size="sm" onClick={() => { setPage(1); load() }}>Filter</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setCreateOpen(true); setCreateErrEmail(null); setCreateErrPwd(null); setCreateSelectedRoles(new Set()) }}>Create User</Button>
          <Button variant="outline" size="sm" onClick={() => setColVis({ ...defaultVis })}>Reset</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2"><Columns3 className="h-4 w-4" /> Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allCols.map(key => (
                <DropdownMenuCheckboxItem
                  key={key}
                  className="capitalize"
                  checked={!!colVis[key]}
                  onCheckedChange={(v) => setColVis(prev => ({ ...prev, [key]: !!v }))}
                >
                  {key.replace('_',' ')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden border rounded">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-50">
              {colVis.id && (
                <TableHead>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => toggleSort('id')}>
                    ID {sortKey === 'id' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </TableHead>
              )}
              {colVis.email && (
                <TableHead>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => toggleSort('email')}>
                    Email {sortKey === 'email' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </TableHead>
              )}
              {colVis.display_name && (
                <TableHead>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => toggleSort('display_name')}>
                    Display Name {sortKey === 'display_name' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </TableHead>
              )}
              {colVis.roles && (
                <TableHead>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Roles</span>
                </TableHead>
              )}
              {colVis.is_active && (
                <TableHead>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => toggleSort('is_active')}>
                    Active {sortKey === 'is_active' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </TableHead>
              )}
              {colVis.created_at && (
                <TableHead>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => toggleSort('created_at')}>
                    Created {sortKey === 'created_at' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </TableHead>
              )}
              {colVis.updated_at && (
                <TableHead>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => toggleSort('updated_at')}>
                    Updated {sortKey === 'updated_at' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </TableHead>
              )}
              {colVis.actions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={visibleCount} className="py-6 text-center text-sm text-gray-500">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={visibleCount} className="py-6 text-center text-sm text-gray-500">No users</TableCell></TableRow>
            ) : sortedRows.map(r => (
              <>
                <TableRow key={r.id}>
                  {colVis.id && <TableCell>{r.id}</TableCell>}
                  {colVis.email && <TableCell>{r.email}</TableCell>}
                  {colVis.display_name && <TableCell>{r.display_name || '-'}</TableCell>}
                  {colVis.roles && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(userRolesMap[r.id] || []).length === 0
                          ? <span className="text-xs text-gray-500">-</span>
                          : (userRolesMap[r.id] || []).map(code => {
                              const label = allRoles.find(ar => ar.code === code)?.name || code
                              return <span key={code} className="inline-block text-xs px-2 py-0.5 bg-gray-100 rounded">{label}</span>
                            })}
                      </div>
                    </TableCell>
                  )}
                  {colVis.is_active && <TableCell>
                    <Checkbox
                      checked={!!r.is_active}
                      disabled={updatingId === r.id || r.id === currentUserId}
                      onCheckedChange={async (v) => {
                        try {
                          setUpdatingId(r.id)
                          const resp = await api.adminUpdateUser(r.id, { is_active: !!v })
                          setRows(prev => prev.map(x => x.id === r.id ? { ...x, is_active: resp.is_active } : x))
                          toast.success(`User ${resp.is_active ? 'activated' : 'deactivated'}`)
                        } catch {
                          toast.error('Failed to update status')
                        } finally {
                          setUpdatingId(null)
                        }
                      }}
                    />
                  </TableCell>}
                  {colVis.created_at && <TableCell>{formatLocalCompact(r.created_at)}</TableCell>}
                  {colVis.updated_at && <TableCell>{formatLocalCompact(r.updated_at)}</TableCell>}
                  {colVis.actions && <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(r); setEditName(r.display_name || ''); setEditActive(!!r.is_active); setEditOpen(true) }}>Edit</Button>
                    </div>
                  </TableCell>}
                </TableRow>
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="sticky bottom-0 bg-white border-t mt-2 flex items-center justify-between gap-2 py-3 px-2 z-10">
        <div className="text-sm text-gray-600">
          <span className="hidden sm:inline">Page {page} of {totalPages} ({total} total)</span>
          <span className="inline sm:hidden">{page}/{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent>
                {[10,20,50,100].map(n => <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => { if (!saving) { setEditOpen(o); if (!o) { setEditRoleNames(new Set()); setRoleTogglePending(new Set()); } } }}>
        <DialogContent onInteractOutside={(e) => { if (saving) e.preventDefault() }} onEscapeKeyDown={(e) => { if (saving) e.preventDefault() }}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Email</div>
              <div className="text-sm">{editing?.email}</div>
            </div>
            {editing?.id ? <UserRolesDisplay userId={editing.id} allRoles={allRoles} /> : null}
            <div>
              <label htmlFor="edit-name" className="text-xs text-gray-600 mb-1">Display name</label>
              <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-active"
                checked={!!editActive}
                disabled={!!editing && editing.id === currentUserId}
                onCheckedChange={(v) => setEditActive(!!v)}
              />
              <label htmlFor="edit-active" className="text-sm">Active</label>
              {!!editing && editing.id === currentUserId && (
                <span className="text-xs text-gray-500">You cannot deactivate your own account.</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-gray-600 mb-1">Roles</div>
              {editRolesLoading ? (
                <div className="text-sm text-gray-500">Loading roles…</div>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-40 overflow-auto p-1 border rounded">
                  {allRoles.map(role => {
                    const key = `${editing?.id || 0}:${role.code}`
                    const checked = editRoleNames.has(role.code)
                    const pending = roleTogglePending.has(key)
                    return (
                      <label key={role.code} className="flex items-center gap-2 text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={pending || !editing}
                          onChange={async (e) => {
                            if (!editing) return
                            const uid = editing.id
                            const next = e.target.checked
                            setRoleTogglePending(prev => new Set(prev).add(key))
                            try {
                              if (next) {
                                await api.adminAssignRoleToUser(uid, role.code)
                                setEditRoleNames(prev => { const s = new Set(prev); s.add(role.code); return s })
                                toast.success('Role assigned')
                              } else {
                                await api.adminRemoveRoleFromUser(uid, role.code)
                                setEditRoleNames(prev => { const s = new Set(prev); s.delete(role.code); return s })
                                toast.success('Role removed')
                              }
                            } catch {
                              toast.error('Update failed')
                            } finally {
                              setRoleTogglePending(prev => { const s = new Set(prev); s.delete(key); return s })
                            }
                          }}
                        />
                        <span>{role.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>Cancel</Button>
            </DialogClose>
            <Button disabled={saving || (!!editing && editing.id === currentUserId && !editActive)} onClick={async () => {
              if (!editing) return
              try {
                setSaving(true)
                const resp = await api.adminUpdateUser(editing.id, { display_name: editName.trim(), is_active: !!editActive })
                toast.success('User updated')
                setRows(prev => prev.map(r => r.id === editing.id ? { ...r, display_name: resp.display_name, is_active: resp.is_active } : r))
                setEditOpen(false)
                setEditing(null)
              } catch {
                toast.error('Failed to update user')
              } finally {
                setSaving(false)
              }
            }}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/** Load roles for the current user when edit dialog opens */}
      {editOpen && editing?.id ? (
        <EditRolesLoader userId={editing.id} onStart={() => setEditRolesLoading(true)} onLoaded={(r) => { setEditRoleNames(new Set(r)); setEditRolesLoading(false) }} />
      ) : null}

      <Dialog open={createOpen} onOpenChange={(o) => { if (!creating) setCreateOpen(o) }}>
        <DialogContent onInteractOutside={(e) => { if (creating) e.preventDefault() }} onEscapeKeyDown={(e) => { if (creating) e.preventDefault() }}>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="cu-email" className="text-xs text-gray-600 mb-1">Email</label>
              <Input id="cu-email" type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} aria-invalid={!!createErrEmail} aria-describedby={createErrEmail ? 'cu-email-err' : undefined} />
              {createErrEmail && <div id="cu-email-err" className="text-xs text-red-600 mt-1">{createErrEmail}</div>}
            </div>
            <div>
              <label htmlFor="cu-name" className="text-xs text-gray-600 mb-1">Display name (optional)</label>
              <Input id="cu-name" value={createName} onChange={e => setCreateName(e.target.value)} />
            </div>
            <PasswordField id="cu-pwd" label="Password" value={createPwd} onChange={setCreatePwd} error={createErrPwd || undefined} name="new-password" autoComplete="new-password" showRequirements />
            <div className="flex items-center gap-2">
              <Checkbox id="cu-active" checked={!!createActive} onCheckedChange={(v) => setCreateActive(!!v)} />
              <label htmlFor="cu-active" className="text-sm">Active</label>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Roles</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-40 overflow-auto p-1 border rounded">
                {allRoles.map(role => (
                  <label key={role.code} className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={createSelectedRoles.has(role.code)}
                      disabled={creating}
                      onChange={(e) => {
                        setCreateSelectedRoles(prev => {
                          const s = new Set(prev)
                          if (e.target.checked) s.add(role.code); else s.delete(role.code)
                          return s
                        })
                      }}
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={creating}>Cancel</Button>
            </DialogClose>
            <Button disabled={creating} onClick={async () => {
              // client validation
              setCreateErrEmail(null); setCreateErrPwd(null)
              const email = createEmail.trim()
              if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setCreateErrEmail('Enter a valid email'); return }
              const pwErr = validatePasswordClient(createPwd)
              if (pwErr) { setCreateErrPwd(pwErr); return }
              try {
                setCreating(true)
                const resp = await api.adminCreateUser({ email, password: createPwd, display_name: createName.trim() || undefined, is_active: !!createActive })
                toast.success('User created')
                // Assign selected roles after creation
                try {
                  if (createSelectedRoles.size) {
                    await Promise.all(Array.from(createSelectedRoles).map(r => api.adminAssignRoleToUser((resp as any).id, r)))
                    toast.success('Roles assigned')
                  }
                } catch {
                  toast.error('Failed to assign selected roles')
                }
                // Refresh or prepend
                setRows(prev => [resp as any as UserRow, ...prev])
                setTotal(t => t + 1)
                setCreateOpen(false)
                setCreateEmail(''); setCreateName(''); setCreatePwd(''); setCreateActive(true); setCreateSelectedRoles(new Set())
              } catch {
                toast.error('Failed to create user')
              } finally {
                setCreating(false)
              }
            }}>{creating ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper component to trigger side-effectful loading tied to presence in tree
function EditRolesLoader({ userId, onStart, onLoaded }: { userId: number; onStart: () => void; onLoaded: (roles: string[]) => void }) {
  useEffectReact(() => {
    (async () => {
      try {
        onStart()
        const r = await api.adminListUserRoles(userId)
        onLoaded(r)
      } catch {
        onLoaded([])
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
  return null
}

function UserRolesDisplay({ userId, allRoles }: { userId: number; allRoles: Array<{ code: string; name: string }> }) {
  const [roles, setRoles] = useStateReact<string[]>([])
  const [loading, setLoading] = useStateReact(true)
  useEffectReact(() => {
    (async () => {
      try { const r = await api.adminListUserRoles(userId); setRoles(r) } catch {} finally { setLoading(false) }
    })()
  }, [userId])
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">Current roles</div>
      <div className="text-sm">
        {loading ? 'Loading…' : (
          roles.map(code => allRoles.find(r => r.code === code)?.name || code).join(', ') || '-'
        )}
      </div>
    </div>
  )
}
