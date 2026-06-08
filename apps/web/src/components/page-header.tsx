import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description: string;
  eyebrow?: string;
  title: string;
};

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-normal text-balance">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
