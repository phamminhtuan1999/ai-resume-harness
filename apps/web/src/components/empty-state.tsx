import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateVariant = "default" | "create" | "error";

type EmptyStateProps = {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  description: string;
  icon?: LucideIcon;
  title: string;
  variant?: EmptyStateVariant;
};

const containerByVariant: Record<EmptyStateVariant, string> = {
  default: "border-dashed bg-muted/30",
  create: "border-border bg-accent/40",
  error: "border-destructive/30 bg-destructive/5",
};

const iconByVariant: Record<EmptyStateVariant, string> = {
  default: "bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand",
  create: "bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand",
  error: "bg-destructive/12 text-destructive",
};

export function EmptyState({
  action,
  children,
  className,
  description,
  icon: Icon,
  title,
  variant = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border p-5 text-sm",
        containerByVariant[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              iconByVariant[variant]
            )}
          >
            <Icon className="size-[18px]" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 leading-6 text-muted-foreground text-pretty">
            {description}
          </p>
        </div>
      </div>
      {children}
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
