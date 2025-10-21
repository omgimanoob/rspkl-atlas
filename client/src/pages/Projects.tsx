import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ProjectsTable, type ProjectRow } from '@/components/projects-table'

// Parent handles layout/header; this page fetches data and passes it to the reusable table.
export function Projects({ me }: { me: { email: string; roles: string[] } }) {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const canEdit = me.roles.includes('hr') || me.roles.includes('directors') || me.roles.includes('admins')
  const canCreateProspective = canEdit
  const [includeKimai, setIncludeKimai] = useState(true)
  const [includeAtlas, setIncludeAtlas] = useState(true)

  // Create Prospective dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [createStatusId, setCreateStatusId] = useState<number | undefined>(undefined)
  const [createPending, setCreatePending] = useState(false)
  const [createErrName, setCreateErrName] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Array<{ id: number; name: string; is_active: number }>>([])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const include: Array<'kimai' | 'atlas'> = []
      if (includeKimai) include.push('kimai')
      if (includeAtlas) include.push('atlas')
      const data = await api.projects({ include })
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadProjects() }, [includeKimai, includeAtlas])

  // Lazy-load statuses when dialog opens
  useEffect(() => {
    if (!createOpen) return
    ;(async () => {
      try {
        const list = await api.listStatusesPublic()
        const active = list.filter(s => Number(s.is_active) === 1).map(s => ({ id: s.id, name: s.name, is_active: s.is_active }))
        setStatuses(active)
      } catch {
        setStatuses([])
      }
    })()
  }, [createOpen])

  const resetCreate = () => {
    setCreateName('')
    setCreateNotes('')
    setCreateStatusId(undefined)
    setCreateErrName(null)
  }

  const onCreateProspective = async () => {
    const name = createName.trim()
    if (!name) { setCreateErrName('Enter a project name'); return }
    if (name.length > 128) { setCreateErrName('Name is too long'); return }
    setCreateErrName(null)
    try {
      setCreatePending(true)
      const payload: any = { name }
      if (createStatusId != null) payload.status_id = createStatusId
      if (createNotes.trim()) payload.notes = createNotes.trim()
      await api.createProspective(payload)
      // Refresh list so newly created Prospective shows up
      try {
        await loadProjects()
        // Switch source filter to include Prospective if needed
        setIncludeAtlas(true)
        toast.success('Prospective project created')
      } catch (e) {
        // Creation succeeded but refresh failed (likely projects fetch error)
        if (import.meta.env.DEV) console.debug('[Projects] refresh after create failed', e)
        toast.warning('Created, but failed to refresh list')
      }
      setCreateOpen(false)
      resetCreate()
    } catch (e: any) {
      if (import.meta.env.DEV) console.debug('[Projects] createProspective failed', e)
      toast.error('Failed to create prospective project')
    } finally {
      setCreatePending(false)
    }
  }

  const saveOverrides = async ({ id, statusId, moneyCollected, isProspective }: { id: number; statusId?: number; moneyCollected: number; isProspective: boolean }) => {
    const saved = await api.updateProjectOverridesById(id, { statusId, moneyCollected, isProspective })
    // Update only the affected row from the server's response
    setRows(prev => prev.map(r => (
      r.id === id
        ? {
            ...r,
            statusId: statusId ?? r.statusId,
            moneyCollected: saved?.money_collected ?? r.moneyCollected,
            isProspective: typeof saved?.is_prospective === 'number' ? saved.is_prospective === 1 : (saved?.is_prospective ?? r.isProspective),
            createdByUserId: saved?.created_by_user_id ?? r.createdByUserId,
          }
        : r
    )))
    return saved
  }

  return (
    <div className="p-4 flex flex-col gap-4 min-h-[calc(100vh-64px)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold">Projects</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Sources</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Include</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={includeKimai} onCheckedChange={v => setIncludeKimai(Boolean(v))}>Kimai</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={includeAtlas} onCheckedChange={v => setIncludeAtlas(Boolean(v))}>Prospective (Atlas)</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {canCreateProspective && (
          <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreate() }}>
            <DialogTrigger asChild>
              <Button size="sm">New Prospective Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Prospective Project</DialogTitle>
                <DialogDescription>Create an Atlas-native draft project. This does not create a Kimai project.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <div className="text-sm text-gray-600">Name</div>
                  <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Enter project name" disabled={createPending} />
                  {createErrName && <div className="text-xs text-red-600">{createErrName}</div>}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-gray-600">Status (optional)</div>
                  <Select value={createStatusId != null ? String(createStatusId) : ''} onValueChange={(v) => setCreateStatusId(v ? Number(v) : undefined)}>
                    <SelectTrigger disabled={createPending || statuses.length === 0}>
                      <SelectValue placeholder={statuses.length ? 'Select status' : 'Statuses unavailable'} />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-gray-600">Notes (optional)</div>
                  <Input value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Add a short note" disabled={createPending} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createPending}>Cancel</Button>
                <Button onClick={onCreateProspective} disabled={createPending}>{createPending ? 'Creating…' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <ProjectsTable
          data={rows}
          canEdit={canEdit}
          onSaveOverrides={saveOverrides}
          defaultPageSize={20}
          loading={loading}
        />
      </div>
    </div>
  )
}
