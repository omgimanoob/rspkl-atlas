import React from 'react'
import { Loader2 } from 'lucide-react'

export function Amount({ value, currency = 'RM', className = '', loading = false, widthCh }: { value: number | string; currency?: string; className?: string; loading?: boolean; widthCh?: number }) {
  const num = Number(value) || 0
  const color = loading ? 'text-muted-foreground' : (num > 0 ? 'text-green-600' : num < 0 ? 'text-red-600' : '')
  return (
    <div
      className={`inline-grid grid-cols-[auto,1fr] items-baseline gap-1 ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' as any }}
    >
      <span className="text-muted-foreground">{currency}</span>
      <span className={`text-right ${color}`} style={widthCh ? { width: `${widthCh}ch` } : { minWidth: '8ch' }}>
        {loading
          ? <Loader2 className="inline-block h-3.5 w-3.5 animate-spin align-middle" />
          : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  )}
