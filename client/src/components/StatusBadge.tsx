import * as React from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type StatusKind = 'ok' | 'error' | 'loading'

export function StatusBadge({
  kind,
  label,
  popover,
  className,
}: {
  kind: StatusKind
  label: string
  popover?: React.ReactNode | string
  className?: string
}) {
  const color = kind === 'ok'
    ? 'text-green-700 dark:text-green-300'
    : kind === 'error'
    ? 'text-red-700'
    : 'text-muted-foreground'

  const content = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        color,
        className,
      )}
    >
      {kind === 'ok' ? (
        <CheckCircle2 className="mr-1 h-4 w-4 text-green-600 dark:text-green-400" />
      ) : kind === 'error' ? (
        <XCircle className="mr-1 h-4 w-4 text-red-600" />
      ) : (
        <Loader2 className="mr-1 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {label}
    </button>
  )

  if (!popover) return content

  return (
    <Popover>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-fit bg-popover text-popover-foreground border shadow-md">
        <div className="text-sm">{popover}</div>
      </PopoverContent>
    </Popover>
  )
}
