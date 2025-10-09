import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

export function Projects({ me }: { me: { email: string; roles: string[] } }) {
  const [rows, setRows] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
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

  const updateStatus = async (id: number, status: string) => {
    await api.updateProjectStatus(id, status)
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
  }

  if (loading) return <div className="p-6">Loading projects…</div>

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <div className="text-sm text-gray-600">{me.email} · {me.roles.join(', ')}</div>
      </header>
      <input
        placeholder="Search by name…"
        className="border rounded px-3 py-2 w-full"
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Project</th>
              <th className="text-left px-3 py-2">Money Collected</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.moneyCollected || 0}</td>
                <td className="px-3 py-2">{r.status || 'Unassigned'}</td>
                <td className="px-3 py-2">
                  <select
                    className="border rounded px-2 py-1"
                    disabled={!canEdit}
                    value={r.status || 'Unassigned'}
                    onChange={e => updateStatus(r.id, e.target.value)}
                  >
                    {['Unassigned','Schematic Design','Design Development','Tender','Under construction','Post construction','KIV','Others']
                      .map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

