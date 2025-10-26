import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatLocalDateTime, formatLocalPopover } from '@/lib/datetime'
import { XCircle, CheckCircle2, MoreVertical, ExternalLink, Loader2 } from 'lucide-react'
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
  const [syncingAll, setSyncingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verify, setVerify] = useState<Verify | null>(null)
  const [healthz, setHealthz] = useState<{ ok: boolean; db: boolean } | null>(null)
  const canSync = me.roles.includes('admins') // rough check; server enforces perms

  async function refresh() {
    setLoading(true)
    setError(null)
    // Clear ephemeral data so badges/cards show loading states while fetching
    setVerify(null)
    setHealthz(null)
    try {
      const h = await api.sync.health()
      setHealth(h)
      try {
        const v = await api.sync.verify()
        setVerify(v)
      } catch {
        setVerify(null)
      }
      try {
        const hz = await api.sync.healthz()
        setHealthz(hz)
      } catch {
        setHealthz(null)
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
  // Use shared popover-style formatter for consistency
  const LastRun = ({ k, label = 'Last run:' }: { k: string; label?: string }) => {
    const v = lastVal(k)
    const display = timeAgo(v)
    const short = formatLocalPopover(v)
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="text-left block">
            {label} <span className="font-medium text-foreground">{display}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="max-w-xs">
          <div className="text-sm">{short}</div>
        </PopoverContent>
      </Popover>
    )
  }
  const LastModified = ({ iso, label = 'Last modified:' }: { iso?: string | null; label?: string }) => {
    const display = timeAgo(iso || null)
    const short = formatLocalPopover(iso || null)
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="text-left">
            {label} <span className="font-medium text-foreground">{display}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="max-w-xs">
          <div className="text-sm">{short}</div>
        </PopoverContent>
      </Popover>
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
  const healthzUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/healthz` : '/api/healthz'

  return (
    <div className="p-4 grid gap-4">
      {/* App Health — Option A: Inline badges under heading */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold">App Health</div>
          <a
            href="/api/healthz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-foreground hover:bg-muted"
            aria-label="Open /healthz in new window"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            kind={healthz == null ? 'loading' : (healthz.ok ? 'ok' : 'error')}
            label={healthz == null ? 'API' : (healthz.ok ? 'API OK' : 'API Degraded')}
            popover={<>
              Browser requested <code className="font-mono">GET {healthzUrl}</code>. {healthz == null ? 'Awaiting response…' : 'OK means the API endpoint responded 200 and basic checks passed.'}
            </>}
          />
          <StatusBadge
            kind={healthz == null ? 'loading' : (healthz.db ? 'ok' : 'error')}
            label={healthz == null ? 'DB' : (healthz.db ? 'DB OK' : 'DB Down')}
            popover={healthz == null ? 'Checking database connectivity…' : 'DB indicates server-to-database connectivity. OK means the API connected to Atlas DB successfully.'}
          />
        </div>
      </div>

      {/* Sync Status header and actions */}
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Kimai Sync Status</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading || syncingAll}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!canSync) return
            try {
              setSyncingAll(true)
              // Trigger all syncs sequentially for clearer logging/order
              await api.sync.projects()
              await api.sync.timesheets()
              await api.sync.users()
              await api.sync.activities()
              await api.sync.tsmeta()
              await api.sync.customers()
              toast.success('Sync all completed')
            } catch {
              toast.error('One or more syncs failed')
            } finally {
              setSyncingAll(false)
            }
            await refresh()
          }} disabled={!canSync || syncingAll || loading}>{syncingAll ? 'Syncing…' : 'Sync All'}</Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-muted-foreground">{error}</div>
      )}

      {/* Config-mapped cards for consistency */}
      {!error && false && (
        <div className="grid auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 [&>div[data-slot=card]]:bg-gradient-to-t [&>div[data-slot=card]]:from-primary/5 [&>div[data-slot=card]]:to-card [&>div[data-slot=card]]:shadow-xs dark:[&>div[data-slot=card]]:bg-card">
          {/* Cards are generated above; refactor in progress to full mapping */}
        </div>
      )}

      {!error && (
        <div className="grid auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 [&>div[data-slot=card]]:bg-gradient-to-t [&>div[data-slot=card]]:from-primary/5 [&>div[data-slot=card]]:to-card [&>div[data-slot=card]]:shadow-xs dark:[&>div[data-slot=card]]:bg-card">
          {([
            { key: 'timesheets', order: 1, title: 'Timesheets', countKey: 'timesheets', useRecent: true, lastRunKey: 'sync.timesheets.last_run', lastModifiedKey: 'sync.timesheets.last_modified_at', menu: [ { label: 'Sync', action: async () => api.sync.timesheets() }, { label: 'Clear', action: async () => { if (!confirm('Clear replica_kimai_timesheets? This cannot be undone.')) return; return api.sync.clear('timesheets') } } ] },
            { key: 'timesheet_meta', order: 2, title: 'Timesheet Meta', countKey: 'timesheet_meta', useRecent: false, lastRunKey: 'sync.tsmeta.last_run', menu: [ { label: 'Sync', action: async () => api.sync.tsmeta() }, { label: 'Clear', action: async () => { if (!confirm('Clear replica_kimai_timesheet_meta?')) return; return api.sync.clear('timesheet_meta') } } ] },
            { key: 'projects', order: 3, title: 'Projects', countKey: 'projects', useRecent: false, lastRunKey: 'sync.projects.last_run', menu: [ { label: 'Sync', action: async () => api.sync.projects() }, { label: 'Clear', action: async () => { if (!confirm('Clear replica_kimai_projects? This cannot be undone.')) return; return api.sync.clear('projects') } } ] },
            { key: 'users', order: 4, title: 'Users', countKey: 'users', useRecent: false, lastRunKey: 'sync.users.last_run', menu: [ { label: 'Sync', action: async () => api.sync.users() }, { label: 'Clear', action: async () => { if (!confirm('Clear replica_kimai_users?')) return; return api.sync.clear('users') } } ] },
            { key: 'activities', order: 5, title: 'Activities', countKey: 'activities', useRecent: false, lastRunKey: 'sync.activities.last_run', menu: [ { label: 'Sync', action: async () => api.sync.activities() }, { label: 'Clear', action: async () => { if (!confirm('Clear replica_kimai_activities?')) return; return api.sync.clear('activities') } } ] },
            { key: 'customers', order: 6, title: 'Customers', countKey: 'customers', useRecent: false, lastRunKey: 'sync.customers.last_run', menu: [ { label: 'Sync', action: async () => api.sync.customers() }, { label: 'Clear', action: async () => { if (!confirm('Clear replica_kimai_customers?')) return; return api.sync.clear('customers') } } ] },
          ] as const)
            .slice()
            .sort((a,b) => a.order - b.order)
            .map((cfg) => (
              <Card key={cfg.key} className="flex h-full flex-col">
                <CardHeader className="pb-2 @container/card">
                  <div className="flex items-start gap-2">
                    <div>
                      <CardDescription>{cfg.title}</CardDescription>
                      <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{fmt((health?.counts as any)?.[cfg.countKey])}</CardTitle>
                    </div>
                    <CardAction>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="data-[state=open]:bg-muted text-muted-foreground" aria-label={`Open ${cfg.title} menu`}>
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {cfg.menu.map((m, i) => (
                            <DropdownMenuItem key={i} disabled={!canSync} onClick={async () => { try { const r = await m.action(); if ((r as any)?.message) toast.success((r as any).message); await refresh() } catch {} }}>{m.label}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardAction>
                  </div>
                  {/* Accuracy badge */}
                  {(() => {
                    if (!verify) return <Badge variant="outline" className="mt-1 text-muted-foreground"><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Checking…</Badge>
                    // For timesheets, prefer totals if totals mismatch; otherwise show recent window accuracy
                    if (cfg.useRecent) {
                      const totals = verify.totals.find(t => t.name === cfg.key)
                      if (totals && !totals.ok) {
                        const ok = totals.ok;
                        const pctRaw = totals.kimai ? (Math.abs(totals.diff)/totals.kimai)*100 : 0;
                        const pct = Math.min(99.99, Math.round(pctRaw * 100) / 100);
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Badge variant="outline" className={`mt-1 ${ok ? 'text-green-700 dark:text-green-300' : 'text-red-700'}`}>
                                {ok ? <CheckCircle2 className="mr-1 h-4 w-4 text-green-600 dark:text-green-400" /> : <XCircle className="mr-1 h-4 w-4 text-red-600" />}
                                {ok ? 'Accuracy OK' : `Mismatch by ${pct}%`}
                              </Badge>
                            </PopoverTrigger>
                            <PopoverContent side="bottom" align="start" className="w-fit">
                              <div className="text-sm">Totals: Replica {totals.replica} / Kimai {totals.kimai}</div>
                            </PopoverContent>
                          </Popover>
                        )
                      }
                      const r = verify.recent; const ok = r.ok;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge variant="outline" className={`mt-1 ${ok ? 'text-green-700 dark:text-green-300' : 'text-red-700'}`}>
                              {ok ? <CheckCircle2 className="mr-1 h-4 w-4 text-green-600 dark:text-green-400" /> : <XCircle className="mr-1 h-4 w-4 text-red-600" />}
                              {ok ? 'Accuracy OK' : 'Mismatch'}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="start" className="w-fit">
                            <div className="text-sm">
                              <div>Totals: Replica {totals ? totals.replica : '-'} / Kimai {totals ? totals.kimai : '-'}</div>
                              <div>Last {r.days}d: Replica {r.replica} / Kimai {r.kimai}</div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )
                    }
                    const row = verify.totals.find(t => t.name === cfg.key); if (!row) return null
                    const ok = row.ok; const pctRaw = row.kimai ? (Math.abs(row.diff)/row.kimai)*100 : 0; const pct = Math.min(99.99, Math.round(pctRaw * 100) / 100)
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Badge variant="outline" className={`cursor-pointer mt-1 ${ok ? 'text-green-700 dark:text-green-300' : 'text-red-700'}`}>
                            {ok ? <CheckCircle2 className="mr-1 h-4 w-4 text-green-600 dark:text-green-400" /> : <XCircle className="mr-1 h-4 w-4 text-red-600" />}
                            {ok ? 'Accuracy OK' : `Mismatch by ${pct}%`}
                          </Badge>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" className="w-fit"><div className="text-sm">Accuracy compares replica vs Kimai totals. Replica {row.replica} / Kimai {row.kimai}</div></PopoverContent>
                      </Popover>
                    )
                  })()}
                </CardHeader>
                <CardContent className=" text-sm text-muted-foreground pt-2" />
                <CardFooter>
                  <LastRun k={cfg.lastRunKey as any} />
                  {'lastModifiedKey' in cfg ? (
                    <LastModified iso={lastVal((cfg as any).lastModifiedKey) || undefined} />
                  ) : null}
                </CardFooter>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
