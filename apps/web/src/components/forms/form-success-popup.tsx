"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";

import type { ActionState } from "@/lib/action-state";

type FormSuccessPopupProps = {
  redirectTo?: string;
  state: ActionState;
  title: string;
};

export function FormSuccessPopup({ redirectTo, state, title }: FormSuccessPopupProps) {
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success" || !redirectTo) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      router.push(redirectTo);
    }, 1800);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [redirectTo, router, state.message, state.status]);

  if (state.status !== "success") {
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
    </div>
  );
}
