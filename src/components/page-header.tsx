import type { ReactNode } from "react"

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  )
}
