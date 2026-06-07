import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import { hasClerkEnv } from "@/lib/env";

export type AppUser = {
  clerkUserId: string;
  email: string;
  fullName: string | null;
};

export async function getCurrentAppUser(): Promise<AppUser | null> {
  if (!hasClerkEnv()) {
    return null;
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
