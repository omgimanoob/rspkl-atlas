import * as React from 'react'
import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/ui/badge'

export function ProjectStatusBadge({ name, color, className }: { name?: string | null; color?: string | null; className?: string }) {
  const label = name || '-'
  const dotStyle: React.CSSProperties = color ? { backgroundColor: color } : {}
  return (
    <span className={cn(
      badgeVariants({ variant: 'outline' }),
      'inline-flex items-center text-muted-foreground px-1.5 gap-1.5',
      className,
    )}>
      <span className="h-2.5 w-2.5 rounded-full" style={dotStyle} />
      <span>{label}</span>
    </span>
  )
}
