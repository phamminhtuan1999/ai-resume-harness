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
    // Location is now country (from a list) + city; the phone is a real US
    // national number that libphonenumber normalizes to E.164.
    await page.getByLabel("Current role").fill("E2E Staff Engineer");
    await page.getByLabel("Years of experience").fill("7");
    await page.getByLabel("Target role").selectOption("LLM Engineer");
    // Target the location/phone controls by name: their help text cross-mentions
    // "country"/"city", so getByLabel substring-matches multiple fields.
    await page.locator('select[name="location_country"]').selectOption("US");
    await page.locator('input[name="location_city"]').fill("San Diego");
    await page.getByLabel("Contact email").fill("e2e-contact@example.com");
    await page.locator('input[name="phone"]').fill("619 555 0199");
    await page.getByLabel("Technical background").fill("E2E: Python, FastAPI, pgvector");

    await page.getByRole("button", { name: "Save profile" }).click();

    // Success toast, scoped to the popup dialog — the text can echo elsewhere.
    await expect(page.getByRole("dialog").getByText("Profile saved.")).toBeVisible();

    // Persisted across a fresh server render. Scope to the main region (the
    // target role also echoes in the sidebar + mobile nav) and take .first():
    // the identity header card intentionally repeats role/location/years
    // alongside the form's read-only detail list.
    await page.goto("/profile");
    const main = page.getByRole("main");
    await expect(main.getByText("E2E Staff Engineer").first()).toBeVisible();
    await expect(main.getByText("7 years").first()).toBeVisible();
    await expect(main.getByText("LLM Engineer").first()).toBeVisible();
    // Country + city composed into "City, Country".
    await expect(main.getByText("San Diego, United States").first()).toBeVisible();
    await expect(main.getByText("e2e-contact@example.com").first()).toBeVisible();
    // Phone normalized to E.164.
    await expect(main.getByText("+16195550199").first()).toBeVisible();

    // And the write reached the database, not just the client cache.
    const saved = await readProfileFields(profileId);
    expect(saved.current_role).toBe("E2E Staff Engineer");
    expect(saved.target_role).toBe("LLM Engineer");
    expect(Number(saved.years_of_experience)).toBe(7);
    expect(saved.location_country).toBe("US");
    expect(saved.location_city).toBe("San Diego");
    expect(saved.location_preference).toBe("San Diego, United States");
    expect(saved.contact_email).toBe("e2e-contact@example.com");
    expect(saved.phone).toBe("+16195550199");
  });
});
