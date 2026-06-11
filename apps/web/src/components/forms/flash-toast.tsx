"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleCheck, X } from "lucide-react";

// Post-redirect flash. The delete/update actions redirect to a list page with a
// short, non-sensitive `?flash=<code>` (never the record's name — see the
// "no personal data in URLs" rule). This reads the code, shows a brief toast,
// and strips the param via history.replaceState so a manual refresh won't
// replay it. replaceState (not router.replace) avoids a server re-render that
// would otherwise drop the prop and kill the toast mid-display.

const FLASH_MESSAGES: Record<string, string> = {
  "job-deleted": "Job deleted.",
  "job-updated": "Job updated.",
  "resume-deleted": "Resume deleted.",
  "resume-updated": "Resume updated.",
};

export function FlashToast({ code }: { code?: string }) {
  const pathname = usePathname();
  const message = code ? FLASH_MESSAGES[code] : undefined;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!message) {
      return;
    }
    window.history.replaceState(null, "", pathname);
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [message, pathname]);

  if (!message || !visible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <CircleCheck className="size-4" />
      </div>
      <p className="min-w-0 text-sm font-medium">{message}</p>
      <button
        type="button"
        aria-label="Dismiss message"
        className="-mt-1 -mr-1 ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={() => setVisible(false)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
