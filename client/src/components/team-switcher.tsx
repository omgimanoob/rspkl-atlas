import * as React from "react"
import logo from '@/assets/rsp-logo.png'

import { DropdownMenu } from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
  orgName,
  subtitle,
}: {
  teams: { name: string; logo: React.ElementType; plan: string }[]
  orgName?: string
  subtitle?: string
}) {
  const name = orgName || import.meta.env.VITE_ORG_NAME || 'RSP Architects'
  const sub = subtitle || ''

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary
            bg-slate-800
             text-sidebar-primary-foreground">
              <img src={logo} alt={name} className="h-6 w-6 object-contain" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{name}</span>
              {sub ? <span className="truncate text-xs">{sub}</span> : null}
            </div>
          </SidebarMenuButton>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
