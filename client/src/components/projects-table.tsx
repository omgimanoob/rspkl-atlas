import { useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type ColumnDef, useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, flexRender, type SortingState } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

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
  status?: string | null
  moneyCollected?: number | null
  isProspective?: boolean | null
  createdByUserId?: number | null
}

export function ProjectsTable({
  data,
  canEdit,
  onSaveStatus,
  defaultPageSize = 10,
}: {
  data: ProjectRow[]
  canEdit: boolean
  onSaveStatus?: (id: number, status: string) => Promise<void>
  defaultPageSize?: number
}) {
  const [q, setQ] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectRow | null>(null)
  const [editStatus, setEditStatus] = useState<string>('Unassigned')
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState({})
  const [sorting, setSorting] = useState<SortingState>([])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return (data || []).filter(r => (r.name || '').toLowerCase().includes(needle))
  }, [data, q])

  const beginEdit = (row: ProjectRow) => {
    setEditing(row)
    setEditStatus(row.status || 'Unassigned')
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editing) return
    try {
      if (onSaveStatus) await onSaveStatus(editing.id, editStatus)
      toast.success(`Updated ${editing.name} → ${editStatus}`)
      setEditOpen(false)
      setEditing(null)
    } catch (e: any) {
      toast.error('Failed to update status')
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
      accessorKey: 'moneyCollected',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Money Collected {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => <span>{row.original.moneyCollected || 0}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Status {column.getIsSorted() === 'asc' ? <ArrowUp className="h-3 w-3" /> : column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
        </button>
      ),
      cell: ({ row }) => {
        const s = row.original.status || 'Unassigned'
        const variant = s === 'Under construction' ? 'warning' : s === 'Post construction' ? 'success' : s === 'KIV' ? 'danger' : s === 'Tender' ? 'info' : 'outline'
        return <Badge variant={variant as any}>{s}</Badge>
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Dialog open={editOpen && editing?.id === row.original.id} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditing(null) } }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => beginEdit(row.original)}>Edit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Project</div>
                <div className="text-sm font-medium">{editing?.name}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Status</div>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Unassigned','Schematic Design','Design Development','Tender','Under construction','Post construction','KIV','Others']
                      .map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={saveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
    },
  ]), [canEdit, editOpen, editing, editStatus])

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: defaultPageSize } },
    state: { rowSelection, columnVisibility, sorting },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
  })

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
            setColumnVisibility({})
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
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id} className="bg-gray-50">
                  {hg.headers.map(header => (
                    <TableHead key={header.id} className="text-gray-700">
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
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-6 text-sm text-gray-500">No results</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
