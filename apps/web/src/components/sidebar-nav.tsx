"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, navItems } from "@/lib/app-data";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(pathname, item);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/70 hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            {isActive ? (
              <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
            ) : null}
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
  );
}
