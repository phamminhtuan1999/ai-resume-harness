"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/*
  US-038 polling: while any AI step is queued/running, refresh the server
  component tree every `intervalMs` so panel rows update in place. Renders
  nothing; mounts only when `active` is true.
*/

type AutoRefreshProps = {
  active: boolean;
  intervalMs?: number;
};

export function AutoRefresh({ active, intervalMs = 3000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return null;
}
