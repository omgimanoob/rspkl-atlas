import { useEffect, useMemo, useState } from 'react'
import { api, extractApiReason } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, Check, X, Users, CircleUser } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'

export function Studios() {
  const [loading, setLoading] = useState(false)
  const [studios, setStudios] = useState<Array<{ id: number; name: string; team_count?: number; director_count?: number }>>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [teams, setTeams] = useState<Array<{ id: number; name: string; color?: string | null }>>([])
  const [assigned, setAssigned] = useState<Array<{ team_id: number; name: string; color?: string | null }>>([])
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [users, setUsers] = useState<Array<{ id: number; username: string; alias?: string | null; email: string; enabled: number }>>([])
  const [directors, setDirectors] = useState<Array<{ user_id: number; username?: string | null; alias?: string | null; email?: string | null }>>([])

  async function loadStudios() {
    setLoading(true)
    try {
      const res = await api.studios.list()
      const items = res.items || []
      setStudios(items)
      if (items.length && (selected == null || !items.some(s => s.id === selected))) {
        setSelected(items[0].id)
      }
    } finally { setLoading(false) }
  }

  async function loadTeams() {
    const all = await api.teams()
    setTeams(all.items || [])
  }
  async function loadUsers() {
    const all = await api.kimaiUsers()
    setUsers(all.items || [])
  }

  async function loadAssigned(studioId: number) {
    const res = await api.studios.teams(studioId)
    setAssigned(res.items || [])
  }

  useEffect(() => { void loadStudios(); void loadTeams(); void loadUsers() }, [])
  useEffect(() => { if (selected != null) { void loadAssigned(selected); void loadDirectors(selected) } }, [selected])
  useEffect(() => {
    if (selected != null) {
      const s = studios.find(s => s.id === selected)
      setEditName(s?.name || '')
      setEditing(false)
    } else {
      setEditName('')
      setEditing(false)
    }
  }, [selected, studios])

  const assignedIds = useMemo(() => new Set(assigned.map(a => a.team_id)), [assigned])

  async function createStudio() {
    const name = newName.trim()
    if (!name) return
    try {
      await api.studios.create(name)
      setNewName('')
      await loadStudios()
      toast.success('Studio created')
    } catch (e: any) {
      toast.error('Failed to create studio')
    }
  }

  async function addTeam(teamId: number) {
    if (selected == null) return
    if (assignedIds.has(teamId)) return
    try {
      await api.studios.addTeam(selected, teamId)
      const t = teams.find(x => x.id === teamId)
      setAssigned(prev => [...prev, { team_id: teamId, name: t?.name || String(teamId), color: t?.color }])
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, team_count: (Number(s.team_count) || 0) + 1 } : s))
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      const teamName = t?.name || String(teamId)
      toast.success(`Added Team "${teamName}" to ${studioName}`)
    } catch (e: any) {
      toast.error(extractApiReason(e) || 'Failed to add team')
    }
  }

  async function removeTeam(teamId: number) {
    if (selected == null) return
    if (!assignedIds.has(teamId)) return
    try {
      await api.studios.removeTeam(selected, teamId)
      setAssigned(prev => prev.filter(a => a.team_id !== teamId))
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, team_count: Math.max(0, (Number(s.team_count) || 0) - 1) } : s))
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      const teamName = teams.find(x => x.id === teamId)?.name || String(teamId)
      toast.success(`Removed Team "${teamName}" from ${studioName}`)
    } catch (e: any) {
      toast.error(extractApiReason(e) || 'Failed to remove team')
    }
  }

  async function loadDirectors(studioId: number) {
    const res = await api.studios.directors(studioId)
    setDirectors(res.items || [])
  }

  const directorIds = useMemo(() => new Set(directors.map(d => d.user_id)), [directors])

  async function addDirector(userId: number) {
    if (selected == null) return
    try {
      await api.studios.addDirector(selected, userId)
      await loadDirectors(selected)
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, director_count: (Number(s.director_count) || 0) + 1 } : s))
      const u = users.find(x => x.id === userId)
      const label = u?.alias || u?.username || u?.email || String(userId)
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      toast.success(`Added Director "${label}" to ${studioName}`)
    } catch (e: any) {
      toast.error(extractApiReason(e) || 'Failed to add director')
    }
  }

  async function removeDirector(userId: number) {
    if (selected == null) return
    try {
      await api.studios.removeDirector(selected, userId)
      await loadDirectors(selected)
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, director_count: Math.max(0, (Number(s.director_count) || 0) - 1) } : s))
      const u = users.find(x => x.id === userId)
      const label = u?.alias || u?.username || u?.email || String(userId)
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      toast.success(`Removed Director "${label}" from ${studioName}`)
    } catch (e: any) {
      toast.error(extractApiReason(e) || 'Failed to remove director')
    }
  }

  async function saveRename() {
    if (selected == null) return
    const name = editName.trim()
    if (!name) { toast.error('Name cannot be empty'); return }
    try {
      await api.studios.update(selected, name)
      await loadStudios()
      toast.success('Studio renamed')
      setEditing(false)
    } catch (e: any) {
      toast.error('Failed to rename studio')
    }
  }

  async function deleteStudio() {
    if (selected == null) return
    const s = studios.find(x => x.id === selected)
    if (!window.confirm(`Delete studio "${s?.name || ''}"? This removes its team assignments.`)) return
    try {
      await api.studios.remove(selected)
      toast.success('Studio deleted')
      setAssigned([])
      await loadStudios()
    } catch (e: any) {
      toast.error('Failed to delete studio')
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-semibold">Studios</div>
        <div className="flex items-center gap-2">
          <Input placeholder="New studio name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void createStudio() }} className="max-w-xs" />
          <Button size="sm" onClick={() => void createStudio()} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Studios list */}
        <div className="border rounded-md">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b">Studios</div>
          <div className="divide-y">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading…</div>
            ) : studios.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No studios yet</div>
            ) : (
              studios.map(s => (
                <div key={s.id} className={`px-3 py-2 text-sm hover:bg-muted/50 ${selected === s.id ? 'bg-muted/50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setSelected(s.id)} className="flex-1 text-left">
                      <div className="font-medium flex items-center gap-2">
                        <span>{s.name}</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <span onClick={(e) => { e.stopPropagation() }} onMouseDown={(e) => { e.stopPropagation() }}>
                              <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer">
                                <Users className="h-3.5 w-3.5" />{s.team_count ?? 0}
                              </Badge>
                            </span>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="start" className="min-w-[220px] text-sm bg-popover text-popover-foreground border shadow-md">
                            {selected === s.id ? (
                              assigned.length ? (
                                <ul className="list-disc pl-4 space-y-1">
                                  {assigned.map(t => (
                                    <li key={t.team_id} className="truncate">{t.name}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-muted-foreground">No teams</div>
                              )
                            ) : (
                              <div className="text-muted-foreground">Select this studio to view teams</div>
                            )}
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <span onClick={(e) => { e.stopPropagation() }} onMouseDown={(e) => { e.stopPropagation() }}>
                              <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer">
                                <CircleUser className="h-3.5 w-3.5" />{s.director_count ?? 0}
                              </Badge>
                            </span>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="start" className="min-w-[260px] text-sm bg-popover text-popover-foreground border shadow-md">
                            {selected === s.id ? (
                              directors.length ? (
                                <ul className="list-disc pl-4 space-y-1">
                                  {directors.map(d => (
                                    <li key={d.user_id} className="truncate">{d.alias || d.username || d.email || d.user_id}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-muted-foreground">No directors</div>
                              )
                            ) : (
                              <div className="text-muted-foreground">Select this studio to view directors</div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </button>
                    {editing && selected === s.id ? (
                      <>
                        <Input className="h-7 w-40" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveRename(); if (e.key === 'Escape') setEditing(false) }} />
                        <Button variant="ghost" size="icon" onClick={() => void saveRename()} aria-label="Save"><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => { setSelected(s.id); setEditName(s.name); setEditing(true) }} aria-label="Rename"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelected(s.id); void deleteStudio() }} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assignment panel: Teams */}
        <div className="md:col-span-2 border rounded-md">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b">
            {selected == null ? 'Teams' : `${assigned.length} Team${assigned.length === 1 ? '' : 's'} in ${studios.find(s => s.id === selected)?.name || ''}`}
          </div>
          <div className="p-3">
            {selected == null ? (
              <div className="text-sm text-muted-foreground">Select a studio…</div>
            ) : teams.length === 0 ? (
              <div className="text-sm text-muted-foreground">No teams available. Run sync for teams.</div>
            ) : (
              <div className="columns-1 md:columns-2 gap-x-4 space-y-2">
                {teams.map(t => {
                  const checked = assignedIds.has(t.id)
                  return (
                    <label key={t.id} className="block w-full break-inside-avoid cursor-pointer">
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox checked={checked} onCheckedChange={(v) => { const on = Boolean(v); if (on && !checked) void addTeam(t.id); if (!on && checked) void removeTeam(t.id) }} />
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: t.color || undefined }}></span>
                        <span className="truncate">{t.name}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Assignment panel: Directors (full width) */}
        <div className="md:col-span-3 border rounded-md">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b">
            {selected == null ? 'Directors' : `${directors.length} Director${directors.length === 1 ? '' : 's'} in ${studios.find(s => s.id === selected)?.name || ''}`}
          </div>
          <div className="p-3">
            {selected == null ? (
              <div className="text-sm text-muted-foreground">Select a studio…</div>
            ) : users.length === 0 ? (
              <div className="text-sm text-muted-foreground">No users available. Run sync for users.</div>
            ) : (
              <div className="columns-1 md:columns-3 gap-x-4 space-y-2">
                {users.map(u => {
                  const checked = directorIds.has(u.id)
                  const label = u.alias || u.username || u.email
                  return (
                    <label key={u.id} className="block w-full break-inside-avoid cursor-pointer">
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox checked={checked} onCheckedChange={(v) => { const on = Boolean(v); if (on && !checked) void addDirector(u.id); if (!on && checked) void removeDirector(u.id) }} />
                        <span className="truncate" title={`${u.alias || u.username || ''}${u.email ? ` <${u.email}>` : ''}`}>{label}{u.email ? ` (${u.email})` : ''}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
