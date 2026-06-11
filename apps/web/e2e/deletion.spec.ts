import { expect, test } from "./fixtures";
import { getClerkUserIdByEmail } from "./support/clerk-admin";
import {
  findDeletionAudit,
  resolveProfileId,
  rowExists,
  SEED,
} from "./support/db";
import { TEST_USER } from "./support/test-user";

// US-055 / US-056 (decision 0016). Exercises real hard deletion through the UI
// confirm, then reads the live DB back to prove the cascade ran and an audit
// row was written. The seededMatchId fixture re-seeds per test and tears down
// (including any deletion audit rows) afterward, so the suite leaves no residue.
// Account deletion's destructive path is NOT submitted here — it would erase
// the shared Clerk test user; only the typed-confirm gating is asserted.

async function profileIdForTestUser(): Promise<string> {
  const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
  return resolveProfileId(clerkUserId);
}

test.describe("Deletion — hard delete with cascade and audit", () => {
  test("deletes a job through the confirm dialog and cascades its match", async ({
    page,
    seededMatchId,
  }) => {
    expect(seededMatchId).toBe(SEED.matchId);
    const profileId = await profileIdForTestUser();

    await page.goto(`/jobs/${SEED.jobId}`);
    await expect(page.getByRole("heading", { name: "Applied AI Engineer" })).toBeVisible();

    await page.getByRole("button", { name: "Delete job" }).click();

    // The confirm panel must state the blast radius before the destructive
    // button is reachable.
    await expect(page.getByText(/Permanently deletes this job/)).toBeVisible();
    await page.getByRole("button", { name: "Delete permanently" }).click();

    // Redirects to the list once the delete lands, with a success flash.
    await page.waitForURL((url) => url.pathname === "/jobs");
    await expect(page.getByText("Job deleted.")).toBeVisible();

    // The write reached the database and cascaded.
    expect(await rowExists("jobs", SEED.jobId)).toBe(false);
    expect(await rowExists("matches", SEED.matchId)).toBe(false);
    // The resume is independent of the job and must survive.
    expect(await rowExists("resumes", SEED.resumeId)).toBe(true);

    const audit = await findDeletionAudit(profileId, "job.deleted");
    expect(audit?.title).toContain("Applied AI Engineer");
  });

  test("deletes a resume through the confirm dialog", async ({ page, seededMatchId }) => {
    expect(seededMatchId).toBe(SEED.matchId);
    const profileId = await profileIdForTestUser();

    await page.goto(`/resumes/${SEED.resumeId}`);
    await expect(
      page.getByRole("heading", { name: "Backend Engineer Resume (E2E)" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete resume" }).click();
    await expect(page.getByText(/Permanently deletes this resume/)).toBeVisible();
    await page.getByRole("button", { name: "Delete permanently" }).click();

    await page.waitForURL((url) => url.pathname === "/resumes");
    await expect(page.getByText("Resume deleted.")).toBeVisible();

    expect(await rowExists("resumes", SEED.resumeId)).toBe(false);
    // The seeded match references this resume and cascades with it.
    expect(await rowExists("matches", SEED.matchId)).toBe(false);

    const audit = await findDeletionAudit(profileId, "resume.deleted");
    expect(audit?.title).toContain("Backend Engineer Resume (E2E)");
  });

  test("cancelling the confirm leaves the record intact", async ({ page, seededMatchId }) => {
    expect(seededMatchId).toBe(SEED.matchId);

    await page.goto(`/jobs/${SEED.jobId}`);
    await page.getByRole("button", { name: "Delete job" }).click();
    await expect(page.getByText(/Permanently deletes this job/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Still on the detail page, nothing deleted.
    await expect(page).toHaveURL(new RegExp(`/jobs/${SEED.jobId}`));
    expect(await rowExists("jobs", SEED.jobId)).toBe(true);
  });
});

test.describe("Record actions menu — list kebab (US-058)", () => {
  test("deletes a job from the row actions menu", async ({ page, seededMatchId }) => {
    expect(seededMatchId).toBe(SEED.matchId);

    await page.goto("/jobs");
    const row = page.getByRole("row", { name: /Applied AI Engineer/ });
    await row.getByRole("button", { name: /Actions for/ }).click();

    // Menu item opens the shared confirm modal (deferred a tick after the menu
    // closes), which must state the blast radius before the destructive button.
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText(/Permanently deletes this job/)).toBeVisible();
    await page.getByRole("button", { name: "Delete permanently" }).click();

    await expect(page.getByText("Job deleted.")).toBeVisible();
    expect(await rowExists("jobs", SEED.jobId)).toBe(false);
  });

  test("renames a job from the row actions menu", async ({ page, seededMatchId }) => {
    expect(seededMatchId).toBe(SEED.matchId);

    await page.goto("/jobs");
    const row = page.getByRole("row", { name: /Applied AI Engineer/ });
    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    // Rename through the modal; the parsed description is untouched.
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Applied AI Engineer (Renamed)");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Job updated.")).toBeVisible();
    // The list re-renders with the new title.
    await expect(page.getByText("Applied AI Engineer (Renamed)")).toBeVisible();
    // The seededMatchId fixture deletes the seeded job by id on teardown, so the
    // rename leaves no residue.
  });
});

test.describe("Account deletion — typed confirmation gate", () => {
  // profileId fixture signs in and restores the profile row afterward; we never
  // submit the destructive form, so it stays untouched.
  test("the destructive button only arms after typing DELETE", async ({ page, profileId }) => {
    expect(profileId).toBeTruthy();

    await page.goto("/settings");
    await expect(page.getByText("Delete account", { exact: true })).toBeVisible();

    const deleteButton = page.getByRole("button", { name: "Delete my account" });
    await expect(deleteButton).toBeDisabled();

    const confirmInput = page.getByLabel(/Type DELETE to confirm/);
    await confirmInput.fill("delete");
    await expect(deleteButton).toBeDisabled();

    await confirmInput.fill("DELETE");
    await expect(deleteButton).toBeEnabled();
    // Intentionally not submitted — see file header.
  });
});
