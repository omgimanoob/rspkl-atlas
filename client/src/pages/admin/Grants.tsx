import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePlaceholder } from '@/components/TablePlaceholder'
import { TablePagination } from '@/components/TablePagination'
import { toast } from 'sonner'

export function AdminGrants() {
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [rows, setRows] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<any>({ subject_type: 'user', subject_id: '', permission: '', resource_type: '', resource_id: '' })
  const load = async () => { try { setRows(await api.adminListGrants()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const total = rows.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const visible = rows.slice(start, end)
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
      <div className="border rounded overflow-x-auto">
        <div className="w-max md:w-full">
        <Table ref={tableRef as any} className="w-full">
          <TableHeader className="bg-muted">
            <TableRow className="bg-muted text-xs font-semibold text-muted-foreground">
              <TableHead>ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Permission</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TablePlaceholder loading={loading} hasRows={rows.length > 0} columns={['id','subject','permission','resource','actions']} skeletonRows={pageSize} emptyMessage="No grants" wide={['subject','resource']} tableRef={tableRef as any} storageKey="tblsizes:admin_grants" />
            {visible.length > 0 && visible.map((r: any) => (
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
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  )
}
