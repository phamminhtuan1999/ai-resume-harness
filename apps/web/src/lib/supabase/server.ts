import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { hasSupabaseEnv, serverEnv } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;

export function getSupabaseServiceClient() {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase env vars are not configured.");
  }

  if (!serviceClient) {
    serviceClient = createClient(
      serverEnv.SUPABASE_URL!,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return serviceClient;
}

