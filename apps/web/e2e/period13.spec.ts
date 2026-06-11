import { readFileSync } from "node:fs";

import { expect, test } from "./fixtures";
import { getClerkUserIdByEmail } from "./support/clerk-admin";
import { resolveProfileId, seedDraftCv } from "./support/db";
import { TEST_USER } from "./support/test-user";

// US-059 — one Tailored CV per match. The retired Markdown resume-draft route
// redirects to the Draft CV, and Markdown is an export format of the Draft CV
// with the same truth-guard gating as PDF/DOCX (byte-level format parity is
// proven by the API test suite; here the browser proves gating end to end).
test.describe("US-059 — single Tailored CV", () => {
  test("the retired resume-draft route redirects to the draft CV", async ({
    page,
    seededMatchId,
  }) => {
    await page.goto(`/matches/${seededMatchId}/resume-draft`);
    await page.waitForURL(`**/matches/${seededMatchId}/draft-cv`);
    await expect(page.getByText("Draft CV", { exact: true }).first()).toBeVisible();
  });

  test("Export Markdown downloads the gated CV", async ({ page, seededMatchId }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedDraftCv(profileId);

    await page.goto(`/matches/${seededMatchId}/draft-cv`);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Markdown" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.md$/);
    const path = await download.path();
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("# Dana E2E Engineer");
    expect(content).toContain("Engineered E2ESafeAlpha services in FastAPI.");
    // The do_not_use_yet bullet never leaves the system, in any format.
    expect(content).not.toContain("E2EForbiddenBeta");
  });
});
