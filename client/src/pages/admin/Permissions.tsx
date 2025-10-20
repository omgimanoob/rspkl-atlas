import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

export function AdminPermissions() {
  const [rows, setRows] = useState<Array<{ id: number; name: string }>>([])
  const [name, setName] = useState('')
  const load = async () => { setRows(await api.adminListPermissions()) }
  useEffect(() => { load() }, [])
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Permission name" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
        <Button size="sm" onClick={async () => { try { const r = await api.adminCreatePermission(name.trim()); toast.success('Permission created'); setRows(prev => [...prev, r]); setName('') } catch { toast.error('Failed to create permission') } }}>Add</Button>
      </div>
      <div className="overflow-hidden border rounded">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-50"><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  <Button size="sm" variant="destructive" onClick={async () => { if (!confirm('Delete permission?')) return; try { await api.adminDeletePermission(r.id); toast.success('Permission deleted'); setRows(prev => prev.filter(x => x.id !== r.id)) } catch { toast.error('Failed to delete permission') } }}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
