import { test as base } from "@playwright/test";

import { signInTestUser } from "./support/auth";
import { getClerkUserIdByEmail } from "./support/clerk-admin";
import {
  readProfileFields,
  resolveProfileId,
  seedAnalyzedMatch,
  teardownAnalyzedMatch,
  writeProfileFields,
} from "./support/db";
import { TEST_USER } from "./support/test-user";

type Period11Fixtures = {
  // The match id of a freshly seeded, analyzed match owned by the signed-in test
  // user. Signs in, ensures the profile exists, seeds, and tears down after.
  seededMatchId: string;
  // The signed-in test user's user_profiles.id. Captures the editable profile
  // fields up front and restores them on teardown, so profile-editing specs
  // leave the row exactly as they found it.
  profileId: string;
};

export const test = base.extend<Period11Fixtures>({
  seededMatchId: async ({ page }, provide) => {
    await signInTestUser(page);
    // First authenticated request creates the user_profiles row.
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    const { matchId } = await seedAnalyzedMatch(profileId);

    await provide(matchId);

    await teardownAnalyzedMatch(profileId);
  },

  profileId: async ({ page }, provide) => {
    await signInTestUser(page);
    // First authenticated request creates the user_profiles row.
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const id = await resolveProfileId(clerkUserId);
    const original = await readProfileFields(id);

    await provide(id);

    await writeProfileFields(id, original);
  },
});

export { expect } from "@playwright/test";
