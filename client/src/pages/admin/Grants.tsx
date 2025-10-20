import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

export function AdminGrants() {
  const [rows, setRows] = useState<Array<any>>([])
  const [payload, setPayload] = useState<any>({ subject_type: 'user', subject_id: '', permission: '', resource_type: '', resource_id: '' })
  const load = async () => { setRows(await api.adminListGrants()) }
  useEffect(() => { load() }, [])
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Subject type</label>
          <select className="border rounded px-2 py-1 w-full" value={payload.subject_type} onChange={e => setPayload((p: any) => ({ ...p, subject_type: e.target.value }))}>
            <option value="user">user</option>
            <option value="role">role</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Subject ID</label>
          <Input value={payload.subject_id} onChange={e => setPayload((p: any) => ({ ...p, subject_id: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Permission</label>
          <Input value={payload.permission} onChange={e => setPayload((p: any) => ({ ...p, permission: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Resource Type</label>
          <Input value={payload.resource_type} onChange={e => setPayload((p: any) => ({ ...p, resource_type: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Resource ID</label>
          <Input value={payload.resource_id} onChange={e => setPayload((p: any) => ({ ...p, resource_id: e.target.value }))} />
        </div>
        <div className="md:col-span-5 flex gap-2">
          <Button size="sm" onClick={async () => { try { await api.adminCreateGrant(payload, true); toast.success('Grant payload valid'); } catch { toast.error('Grant validation failed') } }}>Validate</Button>
          <Button size="sm" onClick={async () => { try { await api.adminCreateGrant(payload); toast.success('Grant created'); await load() } catch { toast.error('Failed to create grant') } }}>Create Grant</Button>
        </div>
      </div>
      <div className="overflow-hidden border rounded">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Permission</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.subjectType} #{r.subjectId}</TableCell>
                <TableCell>{r.permission}</TableCell>
                <TableCell>{r.resourceType || '-'} {r.resourceId || ''}</TableCell>
                <TableCell>
                  <Button size="sm" variant="destructive" onClick={async () => { if (!confirm('Delete grant?')) return; try { await api.adminDeleteGrant(r.id); toast.success('Grant deleted'); setRows(prev => prev.filter((x: any) => x.id !== r.id)) } catch { toast.error('Failed to delete grant') } }}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
