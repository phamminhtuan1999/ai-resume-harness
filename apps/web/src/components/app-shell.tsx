import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { ArrowRight, LogOut, Sparkles } from "lucide-react";

import { hasClerkEnv } from "@/lib/env";
import { navItems, userSummary } from "@/lib/app-data";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type AppShellProps = {
  active: string;
  children: React.ReactNode;
};

export function AppShell({ active, children }: AppShellProps) {
  const UserIcon = userSummary.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_1fr]">
        <aside className="hidden border-r bg-sidebar/80 lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-3 px-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">ApplyWise</span>
              <span className="text-xs text-muted-foreground">AI role copilot</span>
            </div>
          </div>
          <Separator />
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.label;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3">
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                <UserIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userSummary.name}</p>
                <p className="truncate text-xs text-muted-foreground">{userSummary.target}</p>
              </div>
              {hasClerkEnv() ? (
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
        </aside>
        <main className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold lg:hidden">ApplyWise</span>
              <span className="truncate text-xs text-muted-foreground">
                Resume strategy for AI engineering roles
              </span>
            </div>
            <Link
              href="/jobs/new"
              className={buttonVariants({ size: "lg", className: "shrink-0" })}
            >
              Analyze New Job
              <ArrowRight data-icon="inline-end" />
            </Link>
          </header>
          <div className="flex-1 p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
