import { expect, test } from "./fixtures";

// End-to-end coverage for the Period 11 decision-first job-analysis experience.
// Each test gets a freshly seeded, analyzed match (see fixtures.ts) and is torn
// down afterward, so the suite leaves no residue in the live DB.
test.describe("Period 11 — decision-first job analysis", () => {
  test("US-053: Analyzed Jobs list shows the decision badge + match score", async ({
    page,
    seededMatchId,
  }) => {
    expect(seededMatchId).toBeTruthy();
    await page.goto("/matches");

    await expect(page.getByRole("heading", { name: "Analyzed Jobs" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Applied AI Engineer" });
    await expect(row.getByText("Apply With Improvements")).toBeVisible();
    await expect(row.getByText("63", { exact: true })).toBeVisible();
  });

  test("US-048/049/051/053: overview leads with verdict, evidence, breadcrumb + fixed tabs", async ({
    page,
    seededMatchId,
  }) => {
    await page.goto(`/matches/${seededMatchId}`);

    // Breadcrumb (US-053)
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toContainText("Analyzed Jobs");
    await expect(breadcrumb).toContainText("Job Analysis");

    // Header verdict + single-percent line + delta (US-048)
    await expect(page.getByRole("heading", { name: "Applied AI Engineer" })).toBeVisible();
    await expect(page.getByText("Apply With Improvements").first()).toBeVisible();
    await expect(page.getByText(/63% match · Medium risk/)).toBeVisible();
    await expect(page.getByText(/Up from Learning Target/)).toBeVisible();

    // Six fixed tabs in order (US-051)
    const tabs = page.getByRole("navigation", { name: "Job analysis sections" });
    const labels = [
      "Overview",
      "Skill Gaps",
      "Resume Strategy",
      "Application Materials",
      "Interview Prep",
      "Advanced",
    ];
    for (const label of labels) {
      await expect(tabs.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
    }

    // Evidence + material guardrail locked (US-048/049)
    await expect(page.getByText("RAG pipelines").first()).toBeVisible();
    await expect(page.getByText("Generate Draft CV")).toBeVisible();
    await expect(page.getByText("Review your resume strategy first.")).toBeVisible();
  });

  test("US-051/054: Advanced tab shows numeric confidence, workflow panel + decision history", async ({
    page,
    seededMatchId,
  }) => {
    await page.goto(`/matches/${seededMatchId}/advanced`);

    // Numeric confidence lives here, not the header (US-051 / restatement #16).
    // Scope to the card's paragraph — "80%" also appears in the history cell.
    await expect(page.getByText("Analysis confidence")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^80%$/ })).toBeVisible();
    // Relocated workflow panel (US-051)
    await expect(page.getByText("AI workflow")).toBeVisible();

    // Decision history (US-054): transition + rules-version marker + freshness
    await expect(page.getByText("Analysis history")).toBeVisible();
    await expect(page.getByText("Learning Target → Apply With Improvements")).toBeVisible();
    await expect(page.getByText(/Decision rules updated/)).toBeVisible();
    await expect(page.getByText(/Used profile updated/).first()).toBeVisible();
  });

  test("US-052: save as learning target lands in the tracker segment, excluded from active counts", async ({
    page,
    seededMatchId,
  }) => {
    await page.goto(`/matches/${seededMatchId}`);

    // The action lives in the collapsed Advanced-actions group.
    await page.getByText("Advanced actions", { exact: false }).click();
    await page.getByRole("button", { name: "Save as Learning Target" }).click();
    // Wait for the save to persist before navigating (server action + revalidate).
    // Scope to the success dialog — the message also echoes in an inline status.
    await expect(
      page.getByRole("dialog").getByText("Saved as a learning target.")
    ).toBeVisible();

    await page.goto("/tracker");
    // Dedicated segment with its self-defining description (US-052)
    await expect(page.getByText("Learning Targets")).toBeVisible();
    await expect(page.getByText(/not active applications/)).toBeVisible();
    await expect(page.getByText("Northwind AI")).toBeVisible();
    await expect(page.getByRole("link", { name: "4-Week Roadmap" })).toBeVisible();

    // Excluded from active-application counts: the Saved pipeline card stays 0.
    const savedCard = page
      .locator("div")
      .filter({ has: page.getByText("Saved", { exact: true }) })
      .filter({ hasText: "0" })
      .first();
    await expect(savedCard).toBeVisible();
  });
});
