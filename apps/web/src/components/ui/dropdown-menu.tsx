"use client";

import type { ComponentProps } from "react";
import { Menu } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";

// Thin styled wrappers over Base UI's accessible Menu (the same primitive
// library the Button uses). Keyboard nav, focus management, portal, and ARIA
// (role="menu"/"menuitem") come from Base UI; this file only supplies the look.

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

const itemClasses =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none " +
  "data-[highlighted]:bg-muted data-[highlighted]:text-foreground " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

const destructiveItemClasses =
  "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive [&_svg]:text-destructive";

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof Menu.Popup> & {
  align?: ComponentProps<typeof Menu.Positioner>["align"];
  sideOffset?: number;
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner align={align} sideOffset={sideOffset} className="z-50 outline-none">
        <Menu.Popup
          className={cn(
            "min-w-[11rem] origin-[var(--transform-origin)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
            "transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: ComponentProps<typeof Menu.Item> & { variant?: "default" | "destructive" }) {
  return (
    <Menu.Item
      className={cn(itemClasses, variant === "destructive" && destructiveItemClasses, className)}
      {...props}
    />
  );
}

export function DropdownMenuLinkItem({
  className,
  ...props
}: ComponentProps<typeof Menu.LinkItem>) {
  return <Menu.LinkItem className={cn(itemClasses, className)} {...props} />;
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}
