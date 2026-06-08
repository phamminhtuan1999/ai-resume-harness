"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

// The pre-paint script in layout.tsx has already resolved the theme; the server
// render does not know it, so default to light and let the client reconcile.
function getServerSnapshot() {
  return false;
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    // The MutationObserver above picks up the class change and re-renders.
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={className}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
