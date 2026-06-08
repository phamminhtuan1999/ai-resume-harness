"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, X } from "lucide-react";

import type { ActionState } from "@/lib/action-state";

type FormSuccessPopupProps = {
  redirectTo?: string;
  state: ActionState;
  title: string;
};

export function FormSuccessPopup({ redirectTo, state, title }: FormSuccessPopupProps) {
  const router = useRouter();
  const [dismissedState, setDismissedState] = useState<ActionState | null>(null);
  const isVisible = state.status === "success" && dismissedState !== state;

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const dismissTimer = window.setTimeout(() => {
      setDismissedState(state);
    }, 3200);

    const redirectTimer = redirectTo
      ? window.setTimeout(() => {
          router.push(redirectTo);
        }, 1800)
      : undefined;

    return () => {
      window.clearTimeout(dismissTimer);
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [redirectTo, router, state]);

  if (state.status !== "success" || !isVisible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      role="dialog"
      className="fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <CircleCheck className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{state.message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss success message"
        className="-mt-1 -mr-1 ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={() => setDismissedState(state)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
