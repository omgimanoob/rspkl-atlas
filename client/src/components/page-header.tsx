import { ReactNode } from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

type Crumb = {
  label: string
  href?: string
  current?: boolean
}

export function PageHeader({
  title,
  trail,
  right,
}: {
  title: string
  trail: Crumb[]
  right?: ReactNode
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {trail.map((c, i) => (
              <>
                <BreadcrumbItem key={`crumb-${i}`}>
                  {c.current ? (
                    <BreadcrumbPage>{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={c.href || '#'}>{c.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {i < trail.length - 1 && <BreadcrumbSeparator />}
              </>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto flex items-center gap-2 pr-4">
        <h1 className="text-base font-semibold">{title}</h1>
        {right}
      </div>
    </header>
  )
}
