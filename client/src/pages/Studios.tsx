import { useEffect, useMemo, useState, useRef } from 'react'
import { api, extractApiReason } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, Users, CircleUser } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function Studios() {
  const [loading, setLoading] = useState(false)
  const [studios, setStudios] = useState<Array<{ id: number; name: string; team_count?: number; director_count?: number }>>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [teams, setTeams] = useState<Array<{ id: number; name: string; color?: string | null }>>([])
  const [assigned, setAssigned] = useState<Array<{ team_id: number; name: string; color?: string | null }>>([])
  const [editName, setEditName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [users, setUsers] = useState<Array<{ id: number; username: string; alias?: string | null; email: string; enabled: number }>>([])
  const [directors, setDirectors] = useState<Array<{ user_id: number; username?: string | null; alias?: string | null; email?: string | null }>>([])
  const [switchingStudio, setSwitchingStudio] = useState(false)
  const [pendingTeamIds, setPendingTeamIds] = useState<Set<number>>(new Set())
  const [pendingDirectorIds, setPendingDirectorIds] = useState<Set<number>>(new Set())
  const initializedRef = useRef(false)

  async function loadStudios() {
    setLoading(true)
    try {
      const res = await api.studios.list()
      const items = res.items || []
      console.log('[Studios] loadStudios ->', items.length)
      setStudios(items)
      // Auto-select first studio if none selected or selection no longer exists
      if (items.length && (selected == null || !items.some(s => s.id === selected))) {
        setSelected(items[0].id)
      }
    } finally { setLoading(false) }
  }

  async function loadTeams() {
    const all = await api.teams()
    console.log('[Studios] loadTeams ->', (all.items || []).length)
    setTeams(all.items || [])
  }
  async function loadUsers() {
    const all = await api.kimaiUsers()
    console.log('[Studios] loadUsers ->', (all.items || []).length)
    setUsers(all.items || [])
  }

  async function loadAssigned(studioId: number) {
    console.log('[Studios] loadAssigned start', { studioId })
    const res = await api.studios.teams(studioId)
    const items = res.items || []
    console.log('[Studios] loadAssigned done', { studioId, count: items.length })
    setAssigned(items)
  }

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    void loadStudios(); void loadTeams(); void loadUsers()
  }, [])

  const selectSeq = useRef(0);

  useEffect(() => {
    if (selected != null) {
      const seq = ++selectSeq.current
      console.log('[Studios] selected change', { selected, seq })
      // Clear any in-flight toggles from previous studio context
      setPendingTeamIds(new Set())
      setPendingDirectorIds(new Set())
      setSwitchingStudio(true)
      Promise.all([loadAssigned(selected), loadDirectors(selected)])
        .catch(() => {})
        .finally(() => { console.log('[Studios] selected loaded', { selected, seq }); setSwitchingStudio(false) })
    }
  }, [selected])
  
  useEffect(() => {
    if (selected != null) {
      const s = studios.find(s => s.id === selected)
      setEditName(s?.name || '')
    } else {
      setEditName('')
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
    if (switchingStudio) return
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
    if (switchingStudio) return
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
    console.log('[Studios] loadDirectors start', { studioId })
    const res = await api.studios.directors(studioId)
    const items = res.items || []
    console.log('[Studios] loadDirectors done', { studioId, count: items.length })
    setDirectors(items)
  }

  const directorIds = useMemo(() => new Set(directors.map(d => d.user_id)), [directors])

  async function addDirector(userId: number) {
    if (selected == null) return
    if (switchingStudio) return
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
    if (switchingStudio) return
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
      setRenameOpen(false)
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

  // Optimistic toggles
  async function addTeamOptimistic(teamId: number) {
    if (selected == null || switchingStudio || pendingTeamIds.has(teamId) || assignedIds.has(teamId)) return
    const t = teams.find(x => x.id === teamId)
    setPendingTeamIds(prev => { const s = new Set(prev); s.add(teamId); return s })
    setAssigned(prev => [...prev, { team_id: teamId, name: t?.name || String(teamId), color: t?.color }])
    setStudios(prev => prev.map(s => s.id === selected ? { ...s, team_count: (Number(s.team_count) || 0) + 1 } : s))
    try {
      await api.studios.addTeam(selected, teamId)
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      const teamName = t?.name || String(teamId)
      toast.success(`Added Team \"${teamName}\" to ${studioName}`)
    } catch (e: any) {
      setAssigned(prev => prev.filter(a => a.team_id !== teamId))
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, team_count: Math.max(0, (Number(s.team_count) || 0) - 1) } : s))
      toast.error(extractApiReason(e) || 'Failed to add team')
    } finally {
      setPendingTeamIds(prev => { const s = new Set(prev); s.delete(teamId); return s })
    }
  }

  async function removeTeamOptimistic(teamId: number) {
    if (selected == null || switchingStudio || pendingTeamIds.has(teamId) || !assignedIds.has(teamId)) return
    const prevAssigned = assigned
    setPendingTeamIds(prev => { const s = new Set(prev); s.add(teamId); return s })
    setAssigned(prev => prev.filter(a => a.team_id !== teamId))
    setStudios(prev => prev.map(s => s.id === selected ? { ...s, team_count: Math.max(0, (Number(s.team_count) || 0) - 1) } : s))
    try {
      await api.studios.removeTeam(selected, teamId)
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      const teamName = teams.find(x => x.id === teamId)?.name || String(teamId)
      toast.success(`Removed Team \"${teamName}\" from ${studioName}`)
    } catch (e: any) {
      setAssigned(prevAssigned)
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, team_count: (Number(s.team_count) || 0) + 1 } : s))
      toast.error(extractApiReason(e) || 'Failed to remove team')
    } finally {
      setPendingTeamIds(prev => { const s = new Set(prev); s.delete(teamId); return s })
    }
  }

  async function addDirectorOptimistic(userId: number) {
    if (selected == null || switchingStudio || pendingDirectorIds.has(userId) || directorIds.has(userId)) return
    const u = users.find(x => x.id === userId)
    setPendingDirectorIds(prev => { const s = new Set(prev); s.add(userId); return s })
    setDirectors(prev => [...prev, { user_id: userId, username: u?.username, alias: u?.alias, email: u?.email }])
    setStudios(prev => prev.map(s => s.id === selected ? { ...s, director_count: (Number(s.director_count) || 0) + 1 } : s))
    try {
      await api.studios.addDirector(selected, userId)
      void loadDirectors(selected)
      const label = u?.alias || u?.username || u?.email || String(userId)
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      toast.success(`Added Director \"${label}\" to ${studioName}`)
    } catch (e: any) {
      setDirectors(prev => prev.filter(d => d.user_id !== userId))
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, director_count: Math.max(0, (Number(s.director_count) || 0) - 1) } : s))
      toast.error(extractApiReason(e) || 'Failed to add director')
    } finally {
      setPendingDirectorIds(prev => { const s = new Set(prev); s.delete(userId); return s })
    }
  }

  async function removeDirectorOptimistic(userId: number) {
    if (selected == null || switchingStudio || pendingDirectorIds.has(userId) || !directorIds.has(userId)) return
    const prevDirectors = directors
    setPendingDirectorIds(prev => { const s = new Set(prev); s.add(userId); return s })
    setDirectors(prev => prev.filter(d => d.user_id !== userId))
    setStudios(prev => prev.map(s => s.id === selected ? { ...s, director_count: Math.max(0, (Number(s.director_count) || 0) - 1) } : s))
    try {
      await api.studios.removeDirector(selected, userId)
      void loadDirectors(selected)
      const u = users.find(x => x.id === userId)
      const label = u?.alias || u?.username || u?.email || String(userId)
      const studioName = studios.find(s => s.id === selected)?.name || 'studio'
      toast.success(`Removed Director \"${label}\" from ${studioName}`)
    } catch (e: any) {
      setDirectors(prevDirectors)
      setStudios(prev => prev.map(s => s.id === selected ? { ...s, director_count: (Number(s.director_count) || 0) + 1 } : s))
      toast.error(extractApiReason(e) || 'Failed to remove director')
    } finally {
      setPendingDirectorIds(prev => { const s = new Set(prev); s.delete(userId); return s })
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-semibold">Studios</div>
        <div className="flex items-center gap-2">
          <Input placeholder="New studio name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void createStudio() }} className="max-w-xs" />
          <Button size="sm" onClick={() => void createStudio()} disabled={!newName.trim() || switchingStudio}>
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
                    <button onClick={() => { if (!switchingStudio) setSelected(s.id) }} disabled={switchingStudio} aria-disabled={switchingStudio} className={`flex-1 text-left ${switchingStudio ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <div className="font-medium flex items-center gap-2">
                        <span>{s.name}</span>
                      </div>
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <span onClick={(e) => { e.stopPropagation() }} onMouseDown={(e) => { e.stopPropagation() }}>
                          <Badge variant="secondary" className={`flex items-center gap-1 ${switchingStudio ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
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
                          <Badge variant="secondary" className={`flex items-center gap-1 ${switchingStudio ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
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
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); if (switchingStudio) return; setSelected(s.id); setEditName(s.name); setRenameOpen(true) }}
                        disabled={switchingStudio}
                        aria-label="Rename"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={switchingStudio} onClick={(e) => { e.stopPropagation(); if (switchingStudio) return; setSelected(s.id); void deleteStudio() }} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </>
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
            ) : switchingStudio ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : teams.length === 0 ? (
              <div className="text-sm text-muted-foreground">No teams available. Run sync for teams.</div>
            ) : (
              <div className="columns-1 md:columns-2 gap-x-4 space-y-2">
                {teams.map(t => {
                  const checked = assignedIds.has(t.id)
                  return (
                    <label key={t.id} className="block w-full break-inside-avoid cursor-pointer">
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox disabled={switchingStudio || pendingTeamIds.has(t.id)} checked={checked} onCheckedChange={(v) => { if (switchingStudio || pendingTeamIds.has(t.id)) return; const on = Boolean(v); if (on && !checked) void addTeamOptimistic(t.id); if (!on && checked) void removeTeamOptimistic(t.id) }} />
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
            ) : switchingStudio ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
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
                        <Checkbox disabled={switchingStudio || pendingDirectorIds.has(u.id)} checked={checked} onCheckedChange={(v) => { if (switchingStudio || pendingDirectorIds.has(u.id)) return; const on = Boolean(v); if (on && !checked) void addDirectorOptimistic(u.id); if (!on && checked) void removeDirectorOptimistic(u.id) }} />
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

      {/* Rename Studio Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Studio</DialogTitle>
            <DialogDescription>Update the name of the selected studio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveRename() }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveRename()} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
