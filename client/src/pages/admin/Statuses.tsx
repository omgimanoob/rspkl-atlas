import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type StatusRow = { id: number; name: string; code: string | null; is_active: number; sort_order: number | null }

export function AdminStatuses() {
  const [rows, setRows] = useState<StatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sortOrder, setSortOrder] = useState<string>('')
  const [active, setActive] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editSort, setEditSort] = useState<string>('')
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
    setEditSort(r.sort_order != null ? String(r.sort_order) : '')
    setEditActive(!!r.is_active)
  }

  const onSaveEdit = async () => {
    if (editingId == null) return
    try {
      setSaving(true)
      const payload: any = { name: editName.trim(), code: editCode.trim() || null, is_active: !!editActive }
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
    const payload: any = { name: name.trim(), code: code.trim() || null, is_active: !!active }
    const so = sortOrder.trim(); if (so !== '') payload.sort_order = Number(so)
    if (!payload.name) return
    try {
      const created = await api.adminCreateStatus(payload)
      toast.success('Status created')
      setRows(prev => [...prev, created as any])
      setName(''); setCode(''); setSortOrder(''); setActive(true)
    } catch {
      toast.error('Failed to create status')
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete status?')) return
    try { await api.adminDeleteStatus(id); toast.success('Status deleted'); setRows(prev => prev.filter(r => r.id !== id)) } catch { toast.error('Failed to delete status') }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
        <Input placeholder="Code (optional)" value={code} onChange={e => setCode(e.target.value)} className="max-w-xs" />
        <Input placeholder="Sort order (optional)" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="max-w-[140px]" />
        <div className="flex items-center gap-2"><Checkbox id="st-active" checked={active} onCheckedChange={v => setActive(!!v)} /><label htmlFor="st-active" className="text-sm">Active</label></div>
        <Button size="sm" onClick={onCreate}>Add</Button>
      </div>
      <div className="overflow-hidden border rounded">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-50"><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Active</TableHead><TableHead>Sort</TableHead><TableHead>Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeletonRows rows={5} columns={['id','name','code','active','sort','actions']} wide={['name']} />
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-gray-500">No statuses</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{editingId === r.id ? <Input value={editName} onChange={e => setEditName(e.target.value)} className="max-w-xs" /> : r.name}</TableCell>
                <TableCell>{editingId === r.id ? <Input value={editCode} onChange={e => setEditCode(e.target.value)} className="max-w-xs" /> : (r.code || '-')}</TableCell>
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
  )
}
