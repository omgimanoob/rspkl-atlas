import { Skeleton } from '@/components/ui/skeleton'
import { TableRow, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export function TableSkeletonRows({
  columns,
  rows,
  wide = [],
  className,
}: {
  columns: Array<string>
  rows: number
  wide?: Array<string>
  className?: string
}) {
  const wideSet = new Set(wide)
  const count = Math.max(1, rows)
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={`sk-${i}`} className={className}>
          {columns.map((col) => (
            <TableCell key={`${col}-${i}`} className={cn(wideSet.has(col) ? 'w-full' : 'whitespace-nowrap w-px')}>
              <Skeleton className={cn('h-4', wideSet.has(col) ? 'w-full' : 'w-24')} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

