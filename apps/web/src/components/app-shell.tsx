import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { ArrowRight, LogOut } from "lucide-react";

import { hasClerkEnv } from "@/lib/env";
import { userSummary } from "@/lib/app-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";

type AppShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userTarget?: string | null;
};

export function AppShell({ children, userName, userTarget }: AppShellProps) {
  const UserIcon = userSummary.icon;
  const displayName = userName || userSummary.name;
  const displayTarget = userTarget || userSummary.target;
  const clerkEnabled = hasClerkEnv();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[264px_1fr]">
        <aside className="hidden border-r bg-sidebar lg:flex lg:flex-col">
          <div className="flex h-16 items-center px-5">
            <Logo subtitle="AI role copilot" />
          </div>
          <SidebarNav />
          <div className="p-3">
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm shadow-black/[0.02]">
              <div className="flex size-9 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
                <UserIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{displayTarget}</p>
              </div>
              {clerkEnabled ? (
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
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <MobileNav
                hasClerk={clerkEnabled}
                displayName={displayName}
                displayTarget={displayTarget}
              />
              <Logo className="lg:hidden" wordmark={false} />
              <span className="hidden truncate text-sm text-muted-foreground lg:block">
                Resume strategy for AI engineering roles
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <Link
                href="/matches/new"
                className={buttonVariants({ size: "lg", className: "shrink-0" })}
              >
                Analyze match
                <ArrowRight data-icon="inline-end" />
              </Link>
            </div>
          </header>
          <div className="flex-1 p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
