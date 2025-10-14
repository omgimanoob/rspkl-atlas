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
      setRows(data)
      setLoading(false)
    })()
  }, [])

  const saveStatus = async (id: number, status: string) => {
    await api.updateProjectStatus(id, status)
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
  }

  if (loading) return <div className="p-6">Loading projects…</div>

  return (
    <div className="p-x-4 flex flex-col gap-4 min-h-[calc(100vh-64px)]">
      <div className="flex-1 flex flex-col min-h-0">
        <ProjectsTable data={rows} canEdit={canEdit} onSaveStatus={saveStatus} defaultPageSize={20} />
      </div>
    </div>
  )
}

