import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// Layout and header are handled by the parent App; this page focuses on search input and table.

export function Projects({ me }: { me: { email: string; roles: string[] } }) {
  const [rows, setRows] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [editStatus, setEditStatus] = useState<string>('Unassigned')
  const canEdit = me.roles.includes('hr') || me.roles.includes('directors') || me.roles.includes('admins')

  useEffect(() => {
    (async () => {
      const data = await api.projects()
      setRows(data)
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return rows.filter(r => (r.name || '').toLowerCase().includes(needle))
  }, [rows, q])

  const beginEdit = (row: any) => {
    setEditing(row)
    setEditStatus(row.status || 'Unassigned')
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editing) return
    try {
      await api.updateProjectStatus(editing.id, editStatus)
      setRows(prev => prev.map(r => (r.id === editing.id ? { ...r, status: editStatus } : r)))
      toast.success(`Updated ${editing.name} → ${editStatus}`)
      setEditOpen(false)
      setEditing(null)
    } catch (e: any) {
      toast.error('Failed to update status')
    }
  }

  if (loading) return <div className="p-6">Loading projects…</div>

  return (
    <>
      <Input
        placeholder="Search by name…"
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Money Collected</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.moneyCollected || 0}</TableCell>
              <TableCell>{r.status || 'Unassigned'}</TableCell>
              <TableCell>
                <Dialog open={editOpen && editing?.id === r.id} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditing(null) } }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => beginEdit(r)}>
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit status</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">Project</div>
                        <div className="text-sm font-medium">{editing?.name}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">Status</div>
                        <Select value={editStatus} onValueChange={setEditStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {['Unassigned', 'Schematic Design', 'Design Development', 'Tender', 'Under construction', 'Post construction', 'KIV', 'Others']
                              .map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button onClick={saveEdit}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

    </>
  )
}
