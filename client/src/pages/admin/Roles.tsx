import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

export function AdminRoles() {
  const [rows, setRows] = useState<Array<{ id: number; code: string; name: string }>>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const load = async () => { setRows(await api.adminListRoles()) }
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
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Role code (e.g., admins)" value={code} onChange={e => setCode(e.target.value)} className="max-w-xs" />
        <Input placeholder="Role name (e.g., Administrator)" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
        <Button size="sm" onClick={async () => { const payload = { code: code.trim(), name: name.trim() }; if (!payload.code || !payload.name) return; try { const r = await api.adminCreateRole(payload); toast.success('Role created'); setRows(prev => [...prev, r]); setCode(''); setName('') } catch { toast.error('Failed to create role') } }}>Add</Button>
      </div>
      <div className="overflow-hidden border rounded">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-50"><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Permissions</TableHead><TableHead>Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell><code className="text-xs px-1 py-0.5 bg-gray-100 rounded">{r.code}</code></TableCell>
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
  )
}
