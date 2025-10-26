import * as React from "react"
import {
  AudioWaveform,
  GalleryVerticalEnd,
  Command,
  Settings2,
  Home,
  FolderKanban,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data (nav only).
const data = {
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    { title: 'Home', url: '/', icon: Home },
    { title: 'Projects', url: '/projects-v2', icon: FolderKanban },
  ],
  projects: [
    // {
    //   name: "Design Engineering",
    //   url: "#",
    //   icon: Frame,
    // },
    // {
    //   name: "Sales & Marketing",
    //   url: "#",
    //   icon: PieChart,
    // },
    // {
    //   name: "Travel",
    //   url: "#",
    //   icon: Map,
    // },
  ],
}

export function AppSidebar({ me, onLogout, ...props }: React.ComponentProps<typeof Sidebar> & { me: { email: string; roles: string[]; displayName?: string }, onLogout?: () => void }) {
  const displayName = me.displayName || me.email.split('@')[0]
  const user = { name: displayName, email: me.email, avatar: '' }
  const admin = me.roles.includes('admins')
  const nav = [...data.navMain] as any[]
  if (admin) {
    nav.push({
      title: 'Admin',
      url: '#',
      icon: Settings2,
      items: [
        { title: 'Users', url: '/console/users' },
        { title: 'Roles', url: '/console/roles' },
        { title: 'Permissions', url: '/console/permissions' },
        { title: 'Statuses', url: '/console/statuses' },
        { title: 'Grants', url: '/console/grants' },
      ],
    })
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} orgName={import.meta.env.VITE_ORG_NAME} subtitle={import.meta.env.VITE_SYSTEM_NAME || 'Atlas'} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={nav} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
