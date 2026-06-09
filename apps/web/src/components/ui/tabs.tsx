"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/*
  Minimal accessible tabs primitive (US-035). Uncontrolled: the first tab is
  selected by default. Panels are mounted only when active so long question
  lists do not inflate the DOM.
*/

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used inside <Tabs>.`);
  }
  return context;
}

function Tabs({
  defaultValue,
  className,
  children,
}: {
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useTabsContext("TabsTrigger");
  const active = context.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${value}`}
      aria-selected={active}
      aria-controls={`panel-${value}`}
      onClick={() => context.setValue(value)}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useTabsContext("TabsContent");
  if (context.value !== value) {
    return null;
  }
  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={className}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
