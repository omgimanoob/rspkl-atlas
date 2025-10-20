import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { ProjectsTable, type ProjectRow } from '@/components/projects-table'

// Parent handles layout/header; this page fetches data and passes it to the reusable table.
export function Projects({ me }: { me: { email: string; roles: string[] } }) {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const canEdit = me.roles.includes('hr') || me.roles.includes('directors') || me.roles.includes('admins')

  useEffect(() => {
    (async () => {
      const data = await api.projects()
      console.log(data)
      setRows(data)
      setLoading(false)
    })()
  }, [])

  const saveOverrides = async ({ id, statusId, moneyCollected, isProspective }: { id: number; statusId?: number; moneyCollected: number; isProspective: boolean }) => {
    const saved = await api.updateProjectOverridesById(id, { statusId, moneyCollected, isProspective })
    // Update only the affected row from the server's response
    setRows(prev => prev.map(r => (
      r.id === id
        ? {
            ...r,
            status: saved?.status ?? r.status,
            statusId: statusId ?? r.statusId,
            moneyCollected: saved?.money_collected ?? r.moneyCollected,
            isProspective: typeof saved?.is_prospective === 'number' ? saved.is_prospective === 1 : (saved?.is_prospective ?? r.isProspective),
            createdByUserId: saved?.created_by_user_id ?? r.createdByUserId,
          }
        : r
    )))
    return saved
  }

  if (loading) return <div className="p-6">Loading projects…</div>

  return (
    <div className="p-4 flex flex-col gap-4 min-h-[calc(100vh-64px)]">
      <div className="flex-1 flex flex-col min-h-0">
        <ProjectsTable data={rows} canEdit={canEdit} onSaveOverrides={saveOverrides} defaultPageSize={20} />
      </div>
    </div>
  )
}
