import React from 'react'
import { Forbidden } from '@/pages/Forbidden'

export function RequireRoles({ me, anyOf, children }: { me: { roles: string[] }; anyOf: string[]; children: React.ReactNode }) {
  const allowed = Array.isArray(anyOf) && anyOf.some((r) => me.roles.includes(r))
  return allowed ? <>{children}</> : <Forbidden />
}

