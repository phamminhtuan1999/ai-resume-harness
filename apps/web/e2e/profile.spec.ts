import { readProfileFields } from "./support/db";
import { expect, test } from "./fixtures";

// Real, end-to-end profile management: sign in as the Clerk test user, edit the
// career profile through the actual form + server action, and confirm the change
// persists to the live DB. The profileId fixture restores the row afterward, so
// the suite leaves no residue. No analysis/Refresh is triggered — no LLM spend.
test.describe("Career profile — manage & persist", () => {
  test("edits save through the form and persist to the database", async ({
    page,
    profileId,
  }) => {
    expect(profileId).toBeTruthy();

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Career profile" })).toBeVisible();

    // The form opens read-only when a profile already exists — enter edit mode.
    const editButton = page.getByRole("button", { name: "Edit profile" });
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Distinctive values so the persistence checks can't pass by coincidence.
    await page.getByLabel("Current role").fill("E2E Staff Engineer");
    await page.getByLabel("Years of experience").fill("7");
    await page.getByLabel("Target role").selectOption("LLM Engineer");
    await page.getByLabel("Location preference").fill("Remote (E2E)");
    await page.getByLabel("Technical background").fill("E2E: Python, FastAPI, pgvector");

    await page.getByRole("button", { name: "Save profile" }).click();

    // Success toast, scoped to the popup dialog — the text can echo elsewhere.
    await expect(page.getByRole("dialog").getByText("Profile saved.")).toBeVisible();

    // Persisted across a fresh server render: the read-only view shows the
    // values. Scope to the main region — the target role also echoes in the
    // sidebar + mobile nav once it's the user's saved role.
    await page.goto("/profile");
    const main = page.getByRole("main");
    await expect(main.getByText("E2E Staff Engineer")).toBeVisible();
    await expect(main.getByText("7 years")).toBeVisible();
    await expect(main.getByText("LLM Engineer")).toBeVisible();
    await expect(main.getByText("Remote (E2E)")).toBeVisible();

    // And the write reached the database, not just the client cache.
    const saved = await readProfileFields(profileId);
    expect(saved.current_role).toBe("E2E Staff Engineer");
    expect(saved.target_role).toBe("LLM Engineer");
    expect(Number(saved.years_of_experience)).toBe(7);
    expect(saved.location_preference).toBe("Remote (E2E)");
  });
});
