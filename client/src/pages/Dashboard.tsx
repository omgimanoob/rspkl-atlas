import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatLocalDateTime } from '@/lib/datetime'
import { toast } from 'sonner'

type SyncHealth = {
  state: Record<string, { value: string; updated_at: string }>
  counts: Record<string, number>
  replicaLast?: Record<string, string | null>
}
type Verify = {
  totals: Array<{ name: string; kimai: number; replica: number; diff: number; ok: boolean }>
  recent: { days: number; kimai: number; replica: number; diff: number; ok: boolean }
  tolerance: number
}

export function Dashboard({ me }: { me: { email: string; roles: string[] } }) {
  const [health, setHealth] = useState<SyncHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verify, setVerify] = useState<Verify | null>(null)
  const canSync = me.roles.includes('admins') // rough check; server enforces perms

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const h = await api.sync.health()
      setHealth(h)
      try {
        const v = await api.sync.verify()
        setVerify(v)
      } catch {
        setVerify(null)
      }
    } catch (e: any) {
      const msg = e?.status === 403 ? 'No permission to view sync status' : 'Failed to load sync status'
      setError(msg)
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const lastVal = (k: string) => health?.state?.[k]?.value || null
  const timeAgo = (iso?: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.max(0, now.getTime() - d.getTime())
    const sec = Math.floor(diff / 1000)
    if (sec < 10) return 'moments ago'
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    return `${day}d ago`
  }
  const LastRun = ({ k, label = 'Last run:' }: { k: string; label?: string }) => {
    const v = lastVal(k)
    const display = timeAgo(v)
    const full = v ? formatLocalDateTime(v) : '—'
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{label} <span className="font-medium text-foreground">{display}</span></div>
          </TooltipTrigger>
          <TooltipContent>{full}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  const LastModified = ({ iso, label = 'Last modified:' }: { iso?: string | null; label?: string }) => {
    const display = timeAgo(iso || null)
    const full = iso ? formatLocalDateTime(iso) : '—'
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{label} <span className="font-medium text-foreground">{display}</span></div>
          </TooltipTrigger>
          <TooltipContent>{full}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  const Accuracy = ({ name, recent }: { name: string; recent?: boolean }) => {
    if (!verify) return null
    if (name === 'timesheets' && recent) {
      const r = verify.recent
      const cls = r.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600'
      return (
        <div>
          Accuracy (last {r.days}d): <span className={`font-medium ${cls}`}>{r.replica} / {r.kimai} {r.ok ? 'OK' : 'Mismatch'}</span>
        </div>
      )
    }
    const row = verify.totals.find(t => t.name === name)
    if (!row) return null
    const cls = row.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600'
    return (
      <div>
        Accuracy: <span className={`font-medium ${cls}`}>{row.replica} / {row.kimai} {row.ok ? 'OK' : 'Mismatch'}</span>
      </div>
    )
  }
  const fmt = (n?: number) => typeof n === 'number' ? n.toLocaleString() : '0'

  return (
    <div className="p-4 grid gap-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Sync Status</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!canSync) return
            try {
              // Trigger all syncs sequentially for clearer logging/order
              await api.sync.projects()
              await api.sync.timesheets()
              await api.sync.users()
              await api.sync.activities()
              await api.sync.tags()
              await api.sync.customers()
              toast.success('Sync all completed')
            } catch {
              toast.error('One or more syncs failed')
            }
            await refresh()
          }} disabled={!canSync}>Sync All</Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-muted-foreground">{error}</div>
      )}

      {!error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Projects</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Replica count: <span className="font-medium text-foreground">{fmt(health?.counts?.projects)}</span></div>
              <LastRun k="sync.projects.last_run" />
              <LastModified iso={health?.replicaLast?.projects} />
              {canSync && <Accuracy name="projects" />}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async () => { try { await api.sync.projects(); toast.success('Projects sync started'); await refresh() } catch { toast.error('Failed to trigger projects sync') } }} disabled={!canSync}>Sync</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!canSync) return
                  if (!confirm('Clear replica_kimai_projects? This cannot be undone.')) return
                  try { await api.sync.clear('projects'); toast.success('Projects replica cleared'); await refresh() } catch { toast.error('Failed to clear projects replica') }
                }} disabled={!canSync}>Clear</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Timesheets</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Replica count: <span className="font-medium text-foreground">{fmt(health?.counts?.timesheets)}</span></div>
              <LastRun k="sync.timesheets.last_run" />
              <LastModified iso={lastVal('sync.timesheets.last_modified_at') || undefined} />
              {canSync && <Accuracy name="timesheets" recent />}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async () => { try { await api.sync.timesheets(); toast.success('Timesheets sync started'); await refresh() } catch { toast.error('Failed to trigger timesheets sync') } }} disabled={!canSync}>Sync</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!canSync) return
                  if (!confirm('Clear replica_kimai_timesheets? This cannot be undone.')) return
                  try { await api.sync.clear('timesheets'); toast.success('Timesheets replica cleared'); await refresh() } catch { toast.error('Failed to clear timesheets replica') }
                }} disabled={!canSync}>Clear</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Users</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Replica count: <span className="font-medium text-foreground">{fmt(health?.counts?.users)}</span></div>
              <LastRun k="sync.users.last_run" />
              <LastModified iso={health?.replicaLast?.users} />
              {canSync && <Accuracy name="users" />}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async () => { try { await api.sync.users(); toast.success('Users sync started'); await refresh() } catch { toast.error('Failed to trigger users sync') } }} disabled={!canSync}>Sync</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!canSync) return
                  if (!confirm('Clear replica_kimai_users?')) return
                  try { await api.sync.clear('users'); toast.success('Users replica cleared'); await refresh() } catch { toast.error('Failed to clear users replica') }
                }} disabled={!canSync}>Clear</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Activities</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Replica count: <span className="font-medium text-foreground">{fmt(health?.counts?.activities)}</span></div>
              <LastRun k="sync.activities.last_run" />
              <LastModified iso={health?.replicaLast?.activities} />
              {canSync && <Accuracy name="activities" />}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async () => { try { await api.sync.activities(); toast.success('Activities sync started'); await refresh() } catch { toast.error('Failed to trigger activities sync') } }} disabled={!canSync}>Sync</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!canSync) return
                  if (!confirm('Clear replica_kimai_activities?')) return
                  try { await api.sync.clear('activities'); toast.success('Activities replica cleared'); await refresh() } catch { toast.error('Failed to clear activities replica') }
                }} disabled={!canSync}>Clear</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Tags: <span className="font-medium text-foreground">{fmt(health?.counts?.tags)}</span></div>
              <div>Timesheet Tags: <span className="font-medium text-foreground">{fmt(health?.counts?.timesheet_tags)}</span></div>
              <LastRun k="sync.tags.last_run" label="Last run:" />
              <LastModified iso={health?.replicaLast?.tags} />
              {canSync && <Accuracy name="tags" />}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async () => { try { await api.sync.tags(); toast.success('Tags sync started'); await refresh() } catch { toast.error('Failed to trigger tags sync') } }} disabled={!canSync}>Sync</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!canSync) return
                  if (!confirm('Clear replica_kimai_tags and replica_kimai_timesheet_tags?')) return
                  try { await api.sync.clear('tags'); await api.sync.clear('timesheet_tags'); toast.success('Tags replicas cleared'); await refresh() } catch { toast.error('Failed to clear tags replicas') }
                }} disabled={!canSync}>Clear</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Customers</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Replica count: <span className="font-medium text-foreground">{fmt(health?.counts?.customers)}</span></div>
              <LastRun k="sync.customers.last_run" />
              <LastModified iso={health?.replicaLast?.customers} />
              {canSync && <Accuracy name="customers" />}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async () => { try { await api.sync.customers(); toast.success('Customers sync started'); await refresh() } catch { toast.error('Failed to trigger customers sync') } }} disabled={!canSync}>Sync</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!canSync) return
                  if (!confirm('Clear replica_kimai_customers?')) return
                  try { await api.sync.clear('customers'); toast.success('Customers replica cleared'); await refresh() } catch { toast.error('Failed to clear customers replica') }
                }} disabled={!canSync}>Clear</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
