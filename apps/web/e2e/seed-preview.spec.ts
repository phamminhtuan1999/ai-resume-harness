import { test } from "@playwright/test";

import { getClerkUserIdByEmail } from "./support/clerk-admin";
import { resolveProfileId, seedAnalyzedMatch, teardownAnalyzedMatch } from "./support/db";
import { TEST_USER } from "./support/test-user";

// Seeds (or clears) the test profile's analyzed match + decision snapshots and
// LEAVES the data in place — so the no-auth preview (web-noauth) shows populated
// Period 11 surfaces for the impersonated test profile. Excluded from the normal
// E2E suite unless SEED_PREVIEW is set. Run via `npm run seed:preview` /
// `npm run clear:preview` from apps/web.
test.describe("preview seed", () => {
  test.skip(
    !process.env.SEED_PREVIEW,
    "set SEED_PREVIEW=1 to seed, or SEED_PREVIEW=clear to remove, preview data"
  );

  test("seed or clear the test profile's analyzed match (no teardown)", async () => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);

    if (process.env.SEED_PREVIEW === "clear") {
      await teardownAnalyzedMatch(profileId);
      console.log(`[seed-preview] cleared seeded match for profile ${profileId}`);
      return;
    }

    const { matchId } = await seedAnalyzedMatch(profileId);
    console.log(`[seed-preview] seeded match ${matchId} for profile ${profileId}`);
  });
});
