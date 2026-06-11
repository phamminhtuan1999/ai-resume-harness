import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

import { TEST_USER, assertTestUserConfigured } from "./test-user";

// Sign in the test user via Clerk's testing helpers. setupClerkTestingToken
// bypasses bot protection; clerk.signIn drives the Clerk client directly (no
// brittle form typing). Requires a Clerk page to have loaded first.
export async function signInTestUser(page: Page): Promise<void> {
  assertTestUserConfigured();
  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: TEST_USER.email,
      password: TEST_USER.password,
    },
  });
}
