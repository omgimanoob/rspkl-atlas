import { TableRow, TableCell } from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { useEffect, useRef, useState } from 'react'

export function TablePlaceholder({
  loading,
  hasRows,
  columns,
  skeletonRows = 5,
  emptyMessage = 'No results',
  wide = [],
  tableRef,
  storageKey,
}: {
  loading: boolean
  hasRows: boolean
  columns: string[]
  skeletonRows?: number
  emptyMessage?: string
  wide?: string[]
  tableRef?: React.RefObject<HTMLElement>
  storageKey?: string
}) {
  const [sizes, setSizes] = useState<{ widths?: number[]; rowHeight?: number }>(() => {
    if (storageKey) {
      try { const raw = localStorage.getItem(storageKey); if (raw) return JSON.parse(raw) } catch {}
    }
    return {}
  })

  // Capture measurements when real rows are present (and not loading)
  useEffect(() => {
    if (!hasRows || loading || !tableRef?.current) return
    try {
      const tbody = tableRef.current.querySelector('tbody') || tableRef.current
      const row = tbody.querySelector('tr:not([data-skeleton-row])') as HTMLTableRowElement | null
      if (!row) return
      const cells = Array.from(row.children) as HTMLTableCellElement[]
      const widths = cells.map(c => c.getBoundingClientRect().width)
      const rowHeight = row.getBoundingClientRect().height
      const payload = { widths, rowHeight }
      setSizes(payload)
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(payload)) } catch {}
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRows, loading, tableRef?.current])

  if (hasRows) return null
  if (loading) {
    return (
      <TableSkeletonRows rows={skeletonRows} columns={columns} wide={wide} widths={sizes.widths} rowHeight={sizes.rowHeight} />
    )
  }
  return (
    <TableRow>
      <TableCell colSpan={columns.length} className="text-center py-6 text-sm text-gray-500">{emptyMessage}</TableCell>
    </TableRow>
  )
}
