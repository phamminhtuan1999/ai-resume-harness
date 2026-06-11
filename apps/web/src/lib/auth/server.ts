import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import { hasClerkEnv } from "@/lib/env";

export type AppUser = {
  clerkUserId: string;
  email: string;
  fullName: string | null;
};

// No-auth preview/E2E identity. When Clerk is disabled (the `web-noauth` preview
// server) AND APPLYWISE_PREVIEW_CLERK_USER_ID is set, impersonate that Clerk user
// — the Playwright test profile — so the preview renders its real, seeded data.
// Double-gated: a real browser runs with Clerk configured, so hasClerkEnv() is
// true and this never fires; production never sets the env var.
function previewAppUser(): AppUser | null {
  const clerkUserId = process.env.APPLYWISE_PREVIEW_CLERK_USER_ID;
  if (!clerkUserId) {
    return null;
  }
  return {
    clerkUserId,
    email: process.env.APPLYWISE_PREVIEW_USER_EMAIL ?? "preview@applywise.local",
    fullName: "Preview User",
  };
}

// True in no-auth preview mode: Clerk disabled AND a preview Clerk user id set.
// In this mode the data layer calls the API without a session token; the API's
// matching preview mode (APPLYWISE_API_ENV=preview) supplies the identity.
export function isPreviewAuth(): boolean {
  return !hasClerkEnv() && Boolean(process.env.APPLYWISE_PREVIEW_CLERK_USER_ID);
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  if (!hasClerkEnv()) {
    return previewAppUser();
  }

  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!email) {
    return null;
  }

  return {
    clerkUserId: userId,
    email,
    fullName: user?.fullName ?? null,
  };
}

export async function getCurrentSessionToken(): Promise<string | null> {
  if (!hasClerkEnv()) {
    return null;
  }

  const { getToken } = await auth();
  return getToken();
}
