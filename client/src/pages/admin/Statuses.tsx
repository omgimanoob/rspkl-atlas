import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePlaceholder } from '@/components/TablePlaceholder'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { TablePagination } from '@/components/TablePagination'

type StatusRow = { id: number; name: string; code: string | null; color?: string | null; is_active: number; sort_order: number | null }

export function AdminStatuses() {
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [rows, setRows] = useState<StatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sortOrder, setSortOrder] = useState<string>('')
  const [color, setColor] = useState<string>('')
  const [active, setActive] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editSort, setEditSort] = useState<string>('')
  const [editColor, setEditColor] = useState<string>('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setRows(await api.listStatuses() as any) } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const onBeginEdit = (r: StatusRow) => {
    setEditingId(r.id)
    setEditName(r.name)
    setEditCode(r.code || '')
    setEditColor(r.color || '')
    setEditSort(r.sort_order != null ? String(r.sort_order) : '')
    setEditActive(!!r.is_active)
  }

  const onSaveEdit = async () => {
    if (editingId == null) return
    try {
      setSaving(true)
      const payload: any = { name: editName.trim(), code: editCode.trim() || null, color: editColor.trim() || null, is_active: !!editActive }
      const so = editSort.trim(); if (so !== '') payload.sort_order = Number(so)
      const upd = await api.adminUpdateStatus(editingId, payload)
      toast.success('Status updated')
      setRows(prev => prev.map(r => r.id === editingId ? upd as any : r))
      setEditingId(null)
    } catch {
      toast.error('Failed to update status')
    } finally { setSaving(false) }
  }

  const onCreate = async () => {
    const payload: any = { name: name.trim(), code: code.trim() || null, color: color.trim() || null, is_active: !!active }
    const so = sortOrder.trim(); if (so !== '') payload.sort_order = Number(so)
    if (!payload.name) return
    try {
      const created = await api.adminCreateStatus(payload)
      toast.success('Status created')
      setRows(prev => [...prev, created as any])
      setName(''); setCode(''); setColor(''); setSortOrder(''); setActive(true)
    } catch {
      toast.error('Failed to create status')
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete status?')) return
    try { await api.adminDeleteStatus(id); toast.success('Status deleted'); setRows(prev => prev.filter(r => r.id !== id)) } catch { toast.error('Failed to delete status') }
  }

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const total = rows.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const visible = rows.slice(start, end)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
        <Input placeholder="Code (optional)" value={code} onChange={e => setCode(e.target.value)} className="max-w-xs" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Color</label>
          <input type="color" value={color || '#cccccc'} onChange={e => setColor(e.target.value)} className="h-9 w-12 p-1 border rounded" />
        </div>
        <Input placeholder="Sort order (optional)" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="max-w-[140px]" />
        <div className="flex items-center gap-2"><Checkbox id="st-active" checked={active} onCheckedChange={v => setActive(!!v)} /><label htmlFor="st-active" className="text-sm">Active</label></div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
          <span className="sr-only sm:hidden">Add</span>
        </Button>
      </div>
      <div className="border rounded overflow-x-auto">
        <div className="w-max md:w-full">
        <Table ref={tableRef as any} className="w-full">
          <TableHeader className="bg-muted">
            <TableRow className="bg-muted text-xs font-semibold text-muted-foreground"><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Color</TableHead><TableHead>Active</TableHead><TableHead>Sort</TableHead><TableHead>Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TablePlaceholder loading={loading} hasRows={rows.length > 0} columns={['id','name','code','color','active','sort','actions']} skeletonRows={pageSize} emptyMessage="No statuses" wide={['name']} tableRef={tableRef as any} storageKey="tblsizes:admin_statuses" />
            {visible.length > 0 && visible.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{editingId === r.id ? <Input value={editName} onChange={e => setEditName(e.target.value)} className="max-w-xs" /> : r.name}</TableCell>
                <TableCell>{editingId === r.id ? <Input value={editCode} onChange={e => setEditCode(e.target.value)} className="max-w-xs" /> : (r.code || '-')}</TableCell>
                <TableCell>
                  {editingId === r.id ? (
                    <input type="color" value={editColor || '#cccccc'} onChange={e => setEditColor(e.target.value)} className="h-8 w-10 p-1 border rounded" />
                  ) : (
                    r.color ? (
                      <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: r.color }} /> <span className="text-xs text-muted-foreground">{r.color}</span></div>
                    ) : '-'
                  )}
                </TableCell>
                <TableCell>{editingId === r.id ? (
                  <div className="flex items-center gap-2"><Checkbox checked={!!editActive} onCheckedChange={v => setEditActive(!!v)} /><span className="text-xs">Active</span></div>
                ) : (
                  <span className="text-sm">{r.is_active ? 'Yes' : 'No'}</span>
                )}</TableCell>
                <TableCell>{editingId === r.id ? <Input value={editSort} onChange={e => setEditSort(e.target.value)} className="max-w-[120px]" /> : (r.sort_order ?? '')}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {editingId === r.id ? (
                      <>
                        <Button size="sm" onClick={onSaveEdit} disabled={saving}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onBeginEdit(r)}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => onDelete(r.id)}>Delete</Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  )
}
