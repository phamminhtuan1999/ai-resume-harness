import { readFileSync } from "node:fs";

import { expect, test } from "./fixtures";
import { getClerkUserIdByEmail } from "./support/clerk-admin";
import {
  resolveProfileId,
  seedCoverLetter,
  seedDraftCv,
  seedPreservationConflict,
  seedResumeSuggestions,
  seedSecondDraftVersion,
} from "./support/db";
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

    // ready_to_export -> Export is the highlighted current step before the export.
    const stepper = page.getByRole("navigation", { name: "Tailoring steps" });
    const exportStep = stepper.getByRole("link", { name: /Export/ });
    await expect(exportStep).toHaveAttribute("aria-current", "step");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Markdown" }).click();
    const download = await downloadPromise;

    // The export stamps the draft and the page refreshes itself: the journey
    // completes — Export stops being "current" and the status badge flips.
    await expect(exportStep).not.toHaveAttribute("aria-current", "step");
    await expect(page.getByText("Exported", { exact: true }).first()).toBeVisible();

    expect(download.suggestedFilename()).toMatch(/\.md$/);
    const path = await download.path();
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("# Dana E2E Engineer");
    expect(content).toContain("Engineered E2ESafeAlpha services in FastAPI.");
    // The do_not_use_yet bullet never leaves the system, in any format.
    expect(content).not.toContain("E2EForbiddenBeta");
  });
});

// US-061 — tier-1 feedback step: visible stepper, respond flow with provenance,
// explicit feedback→generation link, and the final-check side-by-side trace.
test.describe("US-061 — tier-1 feedback step", () => {
  test("Respond step: stepper, diff context, and accepting a suggestion", async ({
    page,
    seededMatchId,
  }) => {
    await seedResumeSuggestions();

    await page.goto(`/matches/${seededMatchId}/resume-suggestions`);
    const stepper = page.getByRole("navigation", { name: "Tailoring steps" });
    await expect(stepper).toBeVisible();
    // One of two suggestions is responded -> Respond is the current step.
    await expect(stepper.getByRole("link", { name: /Respond/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
    // The edited-and-accepted suggestion is labeled with its provenance.
    await expect(page.getByText("Edited by you")).toBeVisible();

    // Accept the pending suggestion; its card shows the accepted status.
    const pendingCard = page
      .locator("div.rounded-lg.border", { hasText: "Operated E2E workloads on AWS" })
      .first();
    await pendingCard.getByRole("button", { name: "Accept" }).click();
    await expect(pendingCard.getByText("Status: accepted")).toBeVisible();
  });

  test("Generate link and final-check side-by-side trace", async ({
    page,
    seededMatchId,
  }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedResumeSuggestions();
    await seedDraftCv(profileId);

    await page.goto(`/matches/${seededMatchId}/draft-cv`);
    // The explicit feedback→generation link (1 accepted seeded response).
    await expect(page.getByText(/1 approved response shapes this CV/)).toBeVisible();
    // Side-by-side trace: the feedback text and the woven bullet, paired in
    // one row (the bullet also renders in the CV preview, so scope to the row).
    await expect(page.getByText("From your feedback (1)")).toBeVisible();
    const traceRow = page
      .locator("div.rounded-lg.border", { hasText: "Your feedback (edited by you)" })
      .first();
    await expect(
      traceRow.getByText("Shipped FastAPI services powering the E2E payments flow.")
    ).toBeVisible();
    await expect(
      traceRow.getByText("Engineered E2ESafeAlpha services in FastAPI.")
    ).toBeVisible();

    // No responses newer than the draft -> no staleness nudge yet.
    await expect(page.getByText(/changed after this CV was generated/)).not.toBeVisible();
  });

  test("responding after generation shows the regenerate nudge", async ({
    page,
    seededMatchId,
  }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedResumeSuggestions();
    await seedDraftCv(profileId);

    // The user's exact path: the CV already exists, then they respond to a
    // suggestion on Resume Strategy and come back to Application Materials.
    await page.goto(`/matches/${seededMatchId}/resume-suggestions`);
    const pendingCard = page
      .locator("div.rounded-lg.border", { hasText: "Operated E2E workloads on AWS" })
      .first();
    await pendingCard.getByRole("button", { name: "Accept" }).click();
    await expect(pendingCard.getByText("Status: accepted")).toBeVisible();

    await page.goto(`/matches/${seededMatchId}/draft-cv`);
    // Feedback applies at generation time — the page must say so, not let the
    // user export believing the new response is already woven in.
    await expect(page.getByText(/1 response changed after this CV was generated/)).toBeVisible();
    await expect(page.getByText(/Regenerate the draft CV to weave your latest feedback in/)).toBeVisible();
  });

  test("a fallback-generated version is labeled and never claims to weave feedback", async ({
    page,
    seededMatchId,
  }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedResumeSuggestions();
    await seedDraftCv(profileId, { provider: "deterministic" });

    await page.goto(`/matches/${seededMatchId}/draft-cv`);
    // The offline fallback ignores tier-1 feedback — the page says so plainly
    // instead of showing the "N approved responses shape this CV" link.
    await expect(page.getByText(/offline fallback/)).toBeVisible();
    await expect(page.getByText(/shapes this CV/)).not.toBeVisible();
  });
});

// US-060 — tier-2 final check: in-place edit runs one polish+verify pass, the
// user confirms a word-diff ("Keep my wording" exercised here so the assertion
// is deterministic even when the live model polishes), and regenerate
// preservation prompts keep/take instead of dropping confirmed work.
test.describe("US-060 — tier-2 polish-and-confirm", () => {
  test("editing a bullet stages a check and Keep my wording lands the text", async ({
    page,
    seededMatchId,
  }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedDraftCv(profileId);

    await page.goto(`/matches/${seededMatchId}/draft-cv`);
    await page
      .getByRole("button", { name: /Edit bullet: Engineered E2ESafeAlpha/ })
      .click();
    await page
      .getByLabel("Edit this bullet")
      .fill("Engineered E2EEditedGamma services in FastAPI on AWS.");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // One combined pass returns; the confirm actions appear (checking state
    // shows in between). 30s budget: the pass may hit the live model.
    await expect(page.getByRole("button", { name: "Keep my wording" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Keep my wording" }).click();

    // The chosen text lands (preview or review queue, depending on the fresh
    // truth-guard status) — and the editor closes.
    await expect(page.getByText(/E2EEditedGamma/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("a preservation conflict prompts keep/take and keeps the bullet", async ({
    page,
    seededMatchId,
  }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedDraftCv(profileId);
    await seedPreservationConflict();

    await page.goto(`/matches/${seededMatchId}/draft-cv`);
    await expect(page.getByText("Confirmed bullets need a decision (1)")).toBeVisible();
    await expect(page.getByText("Stabilized the E2EConflictDelta platform rollout.")).toBeVisible();

    await page.getByRole("button", { name: "Keep my bullet" }).click();
    // The prompt resolves and the bullet is back on the CV under its entry.
    await expect(page.getByText("Confirmed bullets need a decision (1)")).not.toBeVisible();
    await expect(
      page.getByText("Stabilized the E2EConflictDelta platform rollout.").first()
    ).toBeVisible();
    await expect(page.getByText("Platform Engineer — OldCo")).toBeVisible();
  });
});

// US-062 — deterministic tailoring-coverage panel: base vs tailored percent,
// missing list, the not-claimable separation, and the number moving when a
// bullet covering a missing keyword is approved. No LLM involved.
test.describe("US-062 — tailoring coverage panel", () => {
  test("shows base vs tailored, separates not-claimable, and moves on approval", async ({
    page,
    seededMatchId,
  }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedDraftCv(profileId, { withPendingAwsBullet: true });

    await page.goto(`/matches/${seededMatchId}/draft-cv`);
    await expect(page.getByText("Tailoring coverage")).toBeVisible();
    // Claimable: Python, FastAPI, RAG pipelines, AWS (Kubernetes separated).
    await expect(page.getByText("Base resume 75%")).toBeVisible();
    await expect(page.getByText("Tailored CV 50%")).toBeVisible();
    // Keywords also render in the strategy card's excluded badges, so take
    // the first occurrence.
    await expect(page.getByText("RAG pipelines").first()).toBeVisible(); // missing
    await expect(page.getByText("Not claimable (excluded by Truth Guard)")).toBeVisible();
    await expect(page.getByText("Kubernetes").first()).toBeVisible();

    // Approve the pending AWS bullet -> renderable content now covers AWS.
    const reviewCard = page
      .locator("div.rounded-lg.border", { hasText: "Operated production workloads on AWS." })
      .first();
    await reviewCard.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Tailored CV 75%")).toBeVisible();
  });
});

// US-063 — the cover letter is written from the final Tailored CV: a guided
// error (never a raw-resume fallback) when no CV exists, version linkage on
// the letter card, and a staleness hint when the CV moved on.
test.describe("US-063 — cover letter from the Tailored CV", () => {
  test("without a Tailored CV, generation shows the guided error", async ({
    page,
    seededMatchId,
  }) => {
    await page.goto(`/matches/${seededMatchId}/cover-letter`);
    await expect(page.getByText("Generate the Tailored CV first")).toBeVisible();

    // The API refuses before any model call — a deterministic guided message.
    await page.getByRole("button", { name: /Generate cover letter/i }).click();
    await expect(
      page.getByText(/Generate the Tailored CV first — the cover letter is written from it/)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("letter card shows version linkage and the staleness hint", async ({
    page,
    seededMatchId,
  }) => {
    const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
    const profileId = await resolveProfileId(clerkUserId);
    await seedDraftCv(profileId);
    // The letter was written from v1; v2 is now the latest version -> stale.
    await seedCoverLetter(profileId, { sourceVersion: 1 });
    await seedSecondDraftVersion(profileId);

    await page.goto(`/matches/${seededMatchId}/cover-letter`);
    await expect(page.getByText("From Tailored CV v1")).toBeVisible();
    await expect(
      page.getByText(/Your Tailored CV has changed since this letter/)
    ).toBeVisible();
    await expect(page.getByText(/v2 is current/)).toBeVisible();
  });
});
