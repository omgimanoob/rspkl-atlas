import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePlaceholder } from '@/components/TablePlaceholder'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { TablePagination } from '@/components/TablePagination'

export function AdminPermissions() {
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [rows, setRows] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const load = async () => { try { setRows(await api.adminListPermissions()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const total = rows.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const visible = rows.slice(start, end)
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Permission name" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
        <Button size="sm" onClick={async () => { try { const r = await api.adminCreatePermission(name.trim()); toast.success('Permission created'); setRows(prev => [...prev, r]); setName('') } catch { toast.error('Failed to create permission') } }}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
          <span className="sr-only sm:hidden">Add</span>
        </Button>
      </div>
      <div className="border rounded overflow-x-auto">
        <div className="w-max md:w-full">
        <Table ref={tableRef as any} className="w-full">
          <TableHeader className="bg-muted">
            <TableRow className="bg-muted text-xs font-semibold text-muted-foreground"><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TablePlaceholder loading={loading} hasRows={rows.length > 0} columns={['id','name','actions']} skeletonRows={pageSize} emptyMessage="No permissions" wide={['name']} tableRef={tableRef as any} storageKey="tblsizes:admin_permissions" />
            {visible.length > 0 && visible.map(r => (
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
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  )
}
