"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

import { isNavItemActive, navItems } from "@/lib/app-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

type MobileNavProps = {
  hasClerk: boolean;
  displayName: string;
  displayTarget: string;
};

const noopSubscribe = () => () => {};

// Client-only flag without setState-in-effect (keeps the React 19 lint happy).
function useMounted() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function MobileNav({
  hasClerk,
  displayName,
  displayTarget,
}: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const mounted = useMounted();
  const pathname = usePathname() ?? "";

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Rendered into <body> via a portal so a backdrop-filtered ancestor (the
  // sticky header) cannot become the containing block for this fixed overlay.
  const drawer = (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
        className={cn(
          "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
          open
            ? "bg-background/70 opacity-100 backdrop-blur-sm"
            : "opacity-0"
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r bg-sidebar shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <Logo subtitle="AI role copilot" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/70 hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive
                      ? "text-brand"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t p-3">
          <div className="flex items-center gap-3 px-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {displayTarget}
              </p>
            </div>
            {hasClerk ? (
              <SignOutButton>
                <Button variant="ghost" size="icon-sm" aria-label="Sign out">
                  <LogOut />
                </Button>
              </SignOutButton>
            ) : (
              <Button variant="ghost" size="icon-sm" aria-label="Sign out">
                <LogOut />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
