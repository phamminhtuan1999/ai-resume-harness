"use client";

import { AlertCircle, CircleCheck } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FormStatusMessageProps = {
  successTitle?: string;
  state: ActionState;
};

export function FormStatusMessage({ state, successTitle = "Saved" }: FormStatusMessageProps) {
  if (state.status === "idle") {
    return null;
  }

  const isSuccess = state.status === "success";
  const Icon = isSuccess ? CircleCheck : AlertCircle;

  return (
    <Alert>
      <Icon />
      <AlertTitle>{isSuccess ? successTitle : "Needs attention"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
