import { ReactNode, Fragment } from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ModeToggle } from '@/components/mode-toggle'

type Crumb = {
  label: string
  href?: string
  current?: boolean
}

export function PageHeader({
  trail
}: {
  trail: Crumb[]
}) {
  return (
      <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4 z-10">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
          {trail.map((c, i) => (
            <Fragment key={`crumb-${i}`}>
              <BreadcrumbItem>
                {c.current ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={c.href || '#'}>{c.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {i < trail.length - 1 && <BreadcrumbSeparator />}
            </Fragment>
          ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
        </div>
    </header>
  )
}
