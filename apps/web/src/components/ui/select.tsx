import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/*
  A styled native <select> so dropdowns share the Input height and shape. Native
  keeps keyboard, mobile, and form behavior correct with zero extra wiring, and
  is a drop-in replacement for the hand-styled selects used across the forms.
*/
function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-card pl-3 pr-9 text-sm shadow-sm shadow-black/[0.02] transition-[color,box-shadow,border-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:bg-input/25 dark:shadow-none dark:aria-invalid:border-destructive/50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { Select }
