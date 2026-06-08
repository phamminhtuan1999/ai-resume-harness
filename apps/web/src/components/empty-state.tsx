import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  description: string;
  icon?: LucideIcon;
  title: string;
};

export function EmptyState({
  action,
  children,
  className,
  description,
  icon: Icon,
  title,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-dashed bg-muted/20 p-5 text-sm",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
