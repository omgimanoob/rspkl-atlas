import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePlaceholder } from '@/components/TablePlaceholder'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { TablePagination } from '@/components/TablePagination'

export function AdminRoles() {
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [rows, setRows] = useState<Array<{ id: number; code: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const load = async () => { try { setRows(await api.adminListRoles()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const [permsMap, setPermsMap] = useState<Record<number, string[]>>({})
  const [allPerms, setAllPerms] = useState<string[]>([])
  const [pending, setPending] = useState<Set<string>>(new Set()) // key: `${roleId}:${perm}`
  useEffect(() => {
    (async () => {
      const map: Record<number, string[]> = {}
      for (const r of rows) {
        try { map[r.id] = await api.adminListRolePermissions(r.id) } catch { map[r.id] = [] }
      }
      setPermsMap(map)
    })()
  }, [rows])
  useEffect(() => {
    (async () => {
      try {
        const perms = await api.adminListPermissions()
        setAllPerms(perms.map(p => p.name))
      } catch {
        setAllPerms([])
      }
    })()
  }, [])
  const total = rows.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const visible = rows.slice(start, end)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Role code (e.g., admins)" value={code} onChange={e => setCode(e.target.value)} className="max-w-xs" />
        <Input placeholder="Role name (e.g., Administrator)" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
        <Button size="sm" onClick={async () => { const payload = { code: code.trim(), name: name.trim() }; if (!payload.code || !payload.name) return; try { const r = await api.adminCreateRole(payload); toast.success('Role created'); setRows(prev => [...prev, r]); setCode(''); setName('') } catch { toast.error('Failed to create role') } }}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
          <span className="sr-only sm:hidden">Add</span>
        </Button>
      </div>
      <div className="border rounded overflow-x-auto">
        <div className="w-max md:w-full">
        <Table ref={tableRef as any} className="w-full">
          <TableHeader className="bg-muted">
            <TableRow className="bg-muted text-xs font-semibold text-muted-foreground"><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Permissions</TableHead><TableHead>Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TablePlaceholder loading={loading} hasRows={rows.length > 0} columns={['id','name','code','permissions','actions']} skeletonRows={pageSize} emptyMessage="No roles" wide={['permissions','name']} tableRef={tableRef as any} storageKey="tblsizes:admin_roles" />
            {visible.length > 0 && visible.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs py-0.5">{r.code}</Badge></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-48 overflow-auto p-1">
                    {allPerms.map(p => {
                      const key = `${r.id}:${p}`
                      const assigned = (permsMap[r.id] || []).includes(p)
                      const isPending = pending.has(key)
                      return (
                        <label key={key} className="flex items-center gap-2 text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={assigned}
                            disabled={isPending}
                            onChange={async (e) => {
                              const checked = e.target.checked
                              setPending(prev => new Set(prev).add(key))
                              try {
                                if (checked) {
                                  await api.adminAddPermissionToRole(r.id, p)
                                  setPermsMap(prev => ({ ...prev, [r.id]: Array.from(new Set([...(prev[r.id] || []), p])) }))
                                  toast.success('Permission added')
                                } else {
                                  await api.adminRemovePermissionFromRole(r.id, p)
                                  setPermsMap(prev => ({ ...prev, [r.id]: (prev[r.id] || []).filter(x => x !== p) }))
                                  toast.success('Permission removed')
                                }
                              } catch {
                                toast.error('Update failed')
                              } finally {
                                setPending(prev => { const next = new Set(prev); next.delete(key); return next })
                              }
                            }}
                          />
                          <span>{p}</span>
                        </label>
                      )
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="destructive" onClick={async () => { if (!confirm('Delete role?')) return; try { await api.adminDeleteRole(r.id); toast.success('Role deleted'); setRows(prev => prev.filter(x => x.id !== r.id)) } catch { toast.error('Failed to delete role') } }}>Delete</Button>
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
