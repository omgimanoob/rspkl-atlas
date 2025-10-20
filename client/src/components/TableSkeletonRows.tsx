import { Skeleton } from '@/components/ui/skeleton'
import { TableRow, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export function TableSkeletonRows({
  columns,
  rows,
  wide = [],
  className,
  widths,
  rowHeight,
}: {
  columns: Array<string>
  rows: number
  wide?: Array<string>
  className?: string
  widths?: number[]
  rowHeight?: number
}) {
  const wideSet = new Set(wide)
  const count = Math.max(1, rows)
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={`sk-${i}`} className={className} style={rowHeight ? { height: rowHeight } : undefined} data-skeleton-row>
          {columns.map((col, idx) => (
            <TableCell key={`${col}-${i}`} className={cn(wideSet.has(col) ? 'w-full' : 'whitespace-nowrap w-px')} style={widths && widths[idx] ? { width: widths[idx] } : undefined}>
              <Skeleton className={cn('h-4', wideSet.has(col) ? 'w-full' : 'w-24')} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
