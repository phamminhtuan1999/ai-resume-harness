"use client";

import type { ComponentProps } from "react";
import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";

import { cn } from "@/lib/utils";

// Styled wrappers over Base UI's AlertDialog: a modal, focus-trapped dialog
// that (unlike a plain Dialog) is not dismissed by an outside click — fitting
// for destructive confirmations. Open state is controlled by the caller.

export const AlertDialog = BaseAlertDialog.Root;
export const AlertDialogTrigger = BaseAlertDialog.Trigger;
export const AlertDialogClose = BaseAlertDialog.Close;

export function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseAlertDialog.Popup>) {
  return (
    <BaseAlertDialog.Portal>
      <BaseAlertDialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]",
          "transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
        )}
      />
      <BaseAlertDialog.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border bg-popover p-5 text-popover-foreground shadow-xl outline-none",
          "transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          className
        )}
        {...props}
      >
        {children}
      </BaseAlertDialog.Popup>
    </BaseAlertDialog.Portal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof BaseAlertDialog.Title>) {
  return (
    <BaseAlertDialog.Title
      className={cn("font-display text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof BaseAlertDialog.Description>) {
  return (
    <BaseAlertDialog.Description
      className={cn("mt-1.5 text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-5 flex flex-wrap items-center justify-end gap-2", className)} {...props} />;
}
