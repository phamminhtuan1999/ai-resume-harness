import { AlertCircle } from "lucide-react";

import { hasClerkEnv, hasSupabaseEnv } from "@/lib/env";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SetupNotice() {
  const missing = [
    !hasClerkEnv() && "Clerk",
    !hasSupabaseEnv() && "Supabase",
  ].filter(Boolean);

  if (missing.length === 0) {
    return null;
  }

  return (
    <Alert>
      <AlertCircle />
      <AlertTitle>Setup required for persistence</AlertTitle>
      <AlertDescription>
        {missing.join(" and ")} env vars are not configured. Forms are wired to
        server actions, but saves will be skipped until the environment is
        connected.
      </AlertDescription>
    </Alert>
  );
}
