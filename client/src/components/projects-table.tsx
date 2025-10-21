import { useMemo, useState, useEffect, useRef } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePlaceholder } from '@/components/TablePlaceholder'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type ColumnDef, useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, flexRender, type SortingState } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

export type ProjectRow = {
  id: number
  customer_id: number
  name: string
  order_number: string | null
  comment: string | null
  visible: number
  budget: number
  color: string | null
  time_budget: number
  order_date: string | null
  start: string | null
  end: string | null
  timezone: string | null
  budget_type: string | null
  billable: number
  invoice_text: string | null
  global_activities: number
  statusId?: number | null
  moneyCollected?: number | null
  isProspective?: boolean | null
  createdByUserId?: number | null
  origin?: 'kimai' | 'atlas'
  createdAt?: string | null
  updatedAt?: string | null
}

function CommentCell({ text }: { text: string }) {
  const MAX_CHARS = 120
  const display = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '…' : text
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="truncate block w-full text-left"
          title={text}
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[40ch] whitespace-pre-wrap break-words text-sm text-gray-800">
        {text}
      </PopoverContent>
    </Popover>
  )
}

export function ProjectsTable({
  data,
  canEdit,
  onSaveOverrides,
  defaultPageSize = 10,
  loading = false,
}: {
  data: ProjectRow[]
  canEdit: boolean
  onSaveOverrides?: (payload: { id: number; statusId?: number; moneyCollected: number; isProspective: boolean }) => Promise<any>
  defaultPageSize?: number
  loading?: boolean
}) {
  const DEBUG = true
  const formatAmount = (val: number | null | undefined) => {
    const n = typeof val === 'number' ? val : Number(val || 0)
    return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const [q, setQ] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectRow | null>(null)
  const [statuses, setStatuses] = useState<Array<{ id: number; name: string; is_active: number }>>([])
  const [editStatusId, setEditStatusId] = useState<number | undefined>(undefined)
  const [editMoney, setEditMoney] = useState<string>('0')
  const [editProspective, setEditProspective] = useState<boolean>(false)
  const [rowSelection, setRowSelection] = useState({})
  const STORAGE_KEY_COLS = 'projects.table.colVis'
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COLS)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {}
    return {}
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSaving) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isSaving])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return (data || []).filter(r => (r.name || '').toLowerCase().includes(needle))
  }, [data, q])

  // Load statuses list
  useEffect(() => {
    (async () => {
      try {
        const list = await api.listStatuses()
        const active = list.filter(s => Number(s.is_active) === 1).map(s => ({ id: s.id, name: s.name, is_active: s.is_active }))
        setStatuses(active)
      } catch {
        setStatuses([])
      }
    })()
  }, [])

  const beginEdit = (row: ProjectRow) => {
    if (DEBUG) console.debug('[ProjectsTable] beginEdit', { row })
    setEditing(row)
    // Default to provided statusId or infer by matching status name
    let sid: number | undefined = (row.statusId ?? undefined) as any
    if ((sid == null) && row.status) {
      const m = statuses.find(s => s.name.toLowerCase() === String(row.status).toLowerCase())
      if (m) sid = m.id
    }
    setEditStatusId(sid)
    setEditMoney(String(row.moneyCollected ?? '0'))
    setEditProspective(!!row.isProspective)
    setEditOpen(true)
  }

  // Ensure the status selector reflects current value when statuses arrive after dialog opens
  useEffect(() => {
    if (!editOpen || !editing) return
    if (editStatusId != null) return
    let sid: number | undefined = (editing.statusId ?? undefined) as any
    if ((sid == null) && editing.status) {
      const m = statuses.find(s => s.name.toLowerCase() === String(editing.status).toLowerCase())
      if (m) sid = m.id
    }
    if (sid != null) setEditStatusId(sid)
  }, [editOpen, editing, statuses])

  const hasChanges = useMemo(() => {
    if (!editing) return false
    const originalStatusId = (editing.statusId ?? (() => {
      if (!editing.status) return undefined
      const m = statuses.find(s => s.name.toLowerCase() === String(editing.status).toLowerCase())
      return m?.id
    })()) as number | undefined
    const originalMoney = Number(editing.moneyCollected ?? 0)
    const originalProspective = !!editing.isProspective
    const editedMoney = Number(parseFloat(editMoney || '0')) || 0
    return (
      editStatusId !== originalStatusId ||
      editedMoney !== originalMoney ||
      (!!editProspective) !== originalProspective
    )
  }, [editing, editStatusId, editMoney, editProspective, statuses])

  const saveEdit = async () => {
    if (!editing) return
    try {
      if (DEBUG) console.debug('[ProjectsTable] saveEdit payload', { id: editing.id, editStatusId, editMoney, editProspective })
      const money = Number(parseFloat(editMoney || '0')) || 0
      if (!onSaveOverrides) {
        if (DEBUG) console.warn('[ProjectsTable] onSaveOverrides not provided; skipping API call')
        toast.warning('No save handler wired — changes not persisted')
        return
      }
      setIsSaving(true)
      const saved = await onSaveOverrides({ id: editing.id, statusId: editStatusId, moneyCollected: money, isProspective: !!editProspective })
      // Prefer server response for message if available
      const finalStatus = saved?.status ?? (statuses.find(s => s.id === editStatusId)?.name || '')
      const finalPros = saved?.is_prospective ?? editProspective
      const finalMoney = saved?.money_collected ?? money
      const finalMoneyText = `RM ${(Number(finalMoney) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      toast.success(`Updated ${editing.name} → status: ${finalStatus}, prospective: ${finalPros ? 'Yes' : 'No'}, money: ${finalMoneyText}`)
      setEditOpen(false)
      setEditing(null)
    } catch (e: any) {
      if (DEBUG) console.debug('[ProjectsTable] saveEdit error', e)
      toast.error('Failed to update project')
    } finally {
      setIsSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<ProjectRow>[]>(() => ([
    {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate') as any}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
    },
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'customer_id', header: 'Customer ID' },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Project {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => <span>{row.original.name}</span>,
    },
    {
      accessorKey: 'origin',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Origin {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => {
        const o = row.original.origin
        const label = o === 'atlas' ? 'Prospective' : 'Kimai'
        const variant = o === 'atlas' ? 'secondary' : 'outline'
        return <Badge variant={variant as any}>{label}</Badge>
      },
    },
    { accessorKey: 'order_number', header: 'Order #' },
    { accessorKey: 'visible', header: 'Visible', cell: ({ row }) => <span>{row.original.visible ? 'Yes' : 'No'}</span> },
    { accessorKey: 'budget', header: 'Budget' },
    { accessorKey: 'color', header: 'Color' },
    { accessorKey: 'time_budget', header: 'Time Budget' },
    { accessorKey: 'order_date', header: 'Order Date' },
    { accessorKey: 'start', header: 'Start' },
    { accessorKey: 'end', header: 'End' },
    { accessorKey: 'timezone', header: 'Timezone' },
    { accessorKey: 'budget_type', header: 'Budget Type' },
    { accessorKey: 'billable', header: 'Billable', cell: ({ row }) => <span>{row.original.billable ? 'Yes' : 'No'}</span> },
    { accessorKey: 'invoice_text', header: 'Invoice Text' },
    { accessorKey: 'global_activities', header: 'Global Activities', cell: ({ row }) => <span>{row.original.global_activities ? 'Yes' : 'No'}</span> },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Created At {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <span>{row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : '-'}</span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Updated At {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <span>{row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleString() : '-'}</span>
      ),
    },
    {
      accessorKey: 'moneyCollected',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 ml-auto" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Money Collected {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => (
        // Align currency label (RM) on the left and numeric amount on the right
        // to improve readability; keeps digits right-aligned while preserving a
        // consistent left anchor for the currency label.
        <div className="tabular-nums flex items-baseline justify-between gap-2">
          <span className="text-xs text-gray-700">RM</span>
          <span className="text-right">{formatAmount(row.original.moneyCollected)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'statusId',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Status {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => {
        const sid = row.original.statusId
        const name = statuses.find(s => s.id === sid)?.name || 'Unassigned'
        const variant = name === 'Under construction' ? 'warning' : name === 'Post construction' ? 'success' : name === 'KIV' ? 'danger' : name === 'Tender' ? 'info' : 'outline'
        return <Badge variant={variant as any}>{name}</Badge>
      },
    },
    {
      accessorKey: 'isProspective',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Prospective {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Checkbox checked={!!row.original.isProspective} disabled aria-label="Prospective" />
        </div>
      ),
    },
    { accessorKey: 'comment', header: 'Comment', cell: ({ row }) => {
      const c = row.original.comment || ''
      if (!c) return <span className="text-gray-500">-</span>
      return <CommentCell text={c} />
    } },
    { accessorKey: 'createdByUserId', header: 'Created By' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const r = row.original
        const disabled = !canEdit || r.origin === 'atlas'
        return (
          <Button variant="outline" size="sm" disabled={disabled} onClick={() => beginEdit(r)}>
            Edit
          </Button>
        )
      },
    },
  ]), [canEdit, editOpen, editing, statuses])

  const tableRef = useRef<HTMLTableElement>(null)
  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
    initialState: { pagination: { pageIndex: 0, pageSize: defaultPageSize } },
    state: { rowSelection, columnVisibility, sorting },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
  })

  // Default visible columns
  const defaultVisible = new Set(['name','origin','comment','status','moneyCollected','isProspective','actions'])
  const initialVisibility = useMemo(() => {
    const vis: Record<string, boolean> = {}
    columns.forEach(col => {
      const id = (col.id as string) || (col as any).accessorKey
      if (!id) return
      if (!defaultVisible.has(id)) vis[id] = false
    })
    return vis
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [initApplied, setInitApplied] = useState(false)
  if (!initApplied && Object.keys(initialVisibility).length && Object.keys(columnVisibility).length === 0) {
    // Apply once on first render to avoid flashing all columns
    setColumnVisibility(initialVisibility)
    setInitApplied(true)
  }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_COLS, JSON.stringify(columnVisibility)) } catch {}
  }, [columnVisibility])

  return (
    <div className="flex flex-col gap-2 min-h-[300px]">
      <div className="flex items-center justify-between gap-3 py-2">
        <Input
          placeholder="Search by name…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          {Object.keys(rowSelection).length > 0 && (
            <>
              <div className="text-sm text-gray-600 hidden md:block">
                {Object.keys(rowSelection).length} selected
              </div>
              <div className="text-sm text-gray-600 md:hidden">
                {Object.keys(rowSelection).length} sel
              </div>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            setQ('')
            setColumnVisibility(initialVisibility)
            setRowSelection({})
            setSorting([])
            table.setPageIndex(0)
            table.setPageSize(defaultPageSize)
          }}>Reset</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2"><Columns3 className="h-4 w-4" /> Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns()
                .filter(col => col.getCanHide() && col.id !== 'actions' && col.id !== 'select')
                .map(column => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="overflow-hidden border rounded">
          <Table ref={tableRef} className="w-full">
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id} className="bg-gray-50">
                  {hg.headers.map(header => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'text-gray-700',
                        header.column.id === 'comment' ? 'w-full' : 'whitespace-nowrap w-px'
                      )}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.id === 'comment' ? 'w-full' : 'whitespace-nowrap w-px')}
                    >
                      {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TablePlaceholder
                loading={loading}
                hasRows={table.getRowModel().rows.length > 0}
                columns={table.getAllLeafColumns().filter(c => c.getIsVisible()).map(c => c.id)}
                skeletonRows={table.getState().pagination.pageSize || 5}
                emptyMessage="No results"
                wide={['comment']}
                tableRef={tableRef as any}
                storageKey="tblsizes:projects"
              />
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Centralized dialog to avoid per-row mount/unmount issues */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (DEBUG) console.debug('[ProjectsTable] Central Dialog onOpenChange', { o, editingId: editing?.id })
          if (!o && !isSaving) { setEditOpen(false); setEditing(null) }
        }}
      >
        <DialogContent onInteractOutside={(e) => { if (isSaving) e.preventDefault() }} onEscapeKeyDown={(e) => { if (isSaving) e.preventDefault() }}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update overrides: status, money and prospective visibility.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Project</div>
              <div className="text-sm font-medium">{editing?.name}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Status</div>
              <Select
                value={editStatusId != null ? String(editStatusId) : ''}
                onOpenChange={(open) => { if (DEBUG) console.debug('[ProjectsTable] Select onOpenChange', { open }) }}
                onValueChange={(val) => { if (DEBUG) console.debug('[ProjectsTable] Select onValueChange', { val }); setEditStatusId(val ? Number(val) : undefined) }}
              >
                <SelectTrigger disabled={isSaving || statuses.length === 0}>
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
              <div className="text-sm text-gray-600">Money Collected</div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={editMoney}
                disabled={isSaving}
                onKeyDown={(e) => { if (DEBUG) console.debug('[ProjectsTable] Money onKeyDown', { key: e.key, value: (e.target as HTMLInputElement).value }) }}
                onChange={(e) => {
                  const v = e.target.value
                  const normalized = v.replace(/,/g, '.')
                  if (/^\d*(\.)?\d*$/.test(normalized)) {
                    if (DEBUG) console.debug('[ProjectsTable] Money onChange accepted', { normalized })
                    setEditMoney(normalized)
                  } else {
                    if (DEBUG) console.debug('[ProjectsTable] Money onChange rejected', { v })
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Prospective</div>
              <div className="flex items-center gap-2">
                <Checkbox id="prospective" checked={!!editProspective} disabled={isSaving} onCheckedChange={(v) => { if (DEBUG) console.debug('[ProjectsTable] Prospective onCheckedChange', { v }); setEditProspective(Boolean(v)) }} />
                <label htmlFor="prospective" className="text-sm text-gray-700 select-none">Visible only to director</label>
              </div>
            </div>
            {DEBUG && (
              <pre className="bg-gray-50 text-xs p-2 rounded border overflow-auto max-h-40">
                {JSON.stringify({ editOpen, editingId: editing?.id, editStatusId, editMoney, editProspective }, null, 2)}
              </pre>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving}>Cancel</Button>
            </DialogClose>
            <Button onClick={saveEdit} disabled={isSaving || !hasChanges}>{isSaving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="sticky bottom-0 bg-white border-t mt-2 flex items-center justify-between gap-2 py-3 px-2 z-10">
        <div className="text-sm text-gray-600">
          <span className="hidden sm:inline">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}</span>
          <span className="inline sm:hidden">{table.getState().pagination.pageIndex + 1}/{table.getPageCount() || 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent>
                {[5,10,20,50,100].map(n => <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.setPageIndex(table.getPageCount()-1)} disabled={!table.getCanNextPage()}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
