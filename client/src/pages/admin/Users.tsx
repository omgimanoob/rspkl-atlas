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
import { Columns3, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { validatePasswordClient } from '@/lib/password'
import { PasswordField } from '@/components/PasswordField'

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
  const [rows, setRows] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const allCols = ['id','email','display_name','is_active','created_at','updated_at','actions'] as const
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
    const resp = await api.adminListUsers({ page, pageSize, search: q.trim() || undefined })
    setRows(resp.items)
    setTotal(resp.total)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
  const visibleCount = useMemo(() => allCols.reduce((acc, c) => acc + (colVis[c] ? 1 : 0), 0), [colVis])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colVis)) } catch {}
  }, [colVis])

  // Create user modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [createPwd, setCreatePwd] = useState('')
  const [createActive, setCreateActive] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createErrEmail, setCreateErrEmail] = useState<string | null>(null)
  const [createErrPwd, setCreateErrPwd] = useState<string | null>(null)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2">
          <Input placeholder="Search by email…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
          <Button size="sm" onClick={() => { setPage(1); load() }}>Filter</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setCreateOpen(true); setCreateErrEmail(null); setCreateErrPwd(null) }}>Create User</Button>
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
              {colVis.id && <TableHead>ID</TableHead>}
              {colVis.email && <TableHead>Email</TableHead>}
              {colVis.display_name && <TableHead>Display Name</TableHead>}
              {colVis.is_active && <TableHead>Active</TableHead>}
              {colVis.created_at && <TableHead>Created</TableHead>}
              {colVis.updated_at && <TableHead>Updated</TableHead>}
              {colVis.actions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={visibleCount} className="py-6 text-center text-sm text-gray-500">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={visibleCount} className="py-6 text-center text-sm text-gray-500">No users</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                {colVis.id && <TableCell>{r.id}</TableCell>}
                {colVis.email && <TableCell>{r.email}</TableCell>}
                {colVis.display_name && <TableCell>{r.display_name || '-'}</TableCell>}
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

      <Dialog open={editOpen} onOpenChange={(o) => { if (!saving) setEditOpen(o) }}>
        <DialogContent onInteractOutside={(e) => { if (saving) e.preventDefault() }} onEscapeKeyDown={(e) => { if (saving) e.preventDefault() }}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Email</div>
              <div className="text-sm">{editing?.email}</div>
            </div>
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
                // Refresh or prepend
                setRows(prev => [resp as any as UserRow, ...prev])
                setTotal(t => t + 1)
                setCreateOpen(false)
                setCreateEmail(''); setCreateName(''); setCreatePwd(''); setCreateActive(true)
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
