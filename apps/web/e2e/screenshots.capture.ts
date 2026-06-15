import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "@playwright/test";

import { signInTestUser } from "./support/auth";
import { getClerkUserIdByEmail } from "./support/clerk-admin";
import {
  SEED,
  resolveProfileId,
  seedAnalyzedMatch,
  seedCoverLetter,
  seedDraftCv,
  seedInterviewPrep,
  seedMissingSkills,
  seedResumeSuggestions,
  seedRoadmap,
  teardownAnalyzedMatch,
} from "./support/db";
import { TEST_USER } from "./support/test-user";

// Portfolio screenshot capture. NOT an assertion suite, and NOT part of the
// default e2e run — it is opt-in via `npm run test:e2e:screens`
// (playwright.screenshots.config.ts; the base config ignores *.capture.ts).
//
// It signs in the Clerk test user, seeds a complete analyzed match (+ Truth
// Guard suggestions, missing skills, roadmap, interview prep, a Draft CV, and a
// cover letter), captures each surface in light and dark mode for
// portfolio/generated/screenshots/, then tears the seed down. Writes only under
// the test user's profile, exactly like period11.spec.ts.
//
// Run: npm run test:e2e:screens   (needs Node >= 22 for global WebSocket/fetch)

const OUT_DIR = resolve(__dirname, "../../../portfolio/generated/screenshots");

// Routes to capture. matchId is filled in after seeding. `waitFor` is text the
// page renders once its real (seeded) content is in — so we never shoot a
// loading skeleton.
type Shot = { file: string; path: (m: string) => string; waitFor?: RegExp };

const SHOTS: Shot[] = [
  { file: "09-landing.png", path: () => "/" },
  { file: "08-pricing-credits.png", path: () => "/pricing" },
  { file: "07-dashboard.png", path: () => "/dashboard" },
  {
    file: "02-analyzed-jobs-list.png",
    path: () => "/matches",
    waitFor: /Apply With Improvements/,
  },
  {
    file: "01-job-analysis-overview.png",
    path: (m) => `/matches/${m}`,
    waitFor: /63% match · Medium risk/,
  },
  {
    file: "05-skill-gaps.png",
    path: (m) => `/matches/${m}/gaps`,
    waitFor: /Vector Embeddings/,
  },
  {
    file: "03-truth-guard-suggestions.png",
    path: (m) => `/matches/${m}/resume-suggestions`,
    waitFor: /Safe to use|Needs confirmation/,
  },
  {
    file: "04-draft-cv-export.png",
    path: (m) => `/matches/${m}/draft-cv`,
    waitFor: /Northwind AI|Export/,
  },
  {
    file: "11-roadmap.png",
    path: (m) => `/matches/${m}/roadmap`,
    waitFor: /Week 1|pgvector|roadmap/i,
  },
  {
    file: "12-interview-prep.png",
    path: (m) => `/matches/${m}/interview-prep`,
    waitFor: /RAG pipeline|FastAPI services in production/i,
  },
  {
    file: "10-cover-letter.png",
    path: (m) => `/matches/${m}/cover-letter`,
    waitFor: /Northwind AI|cover letter/i,
  },
  {
    file: "06-advanced-decision-history.png",
    path: (m) => `/matches/${m}/advanced`,
    waitFor: /Apply With Improvements/,
  },
];

test("capture portfolio screenshots", async ({ page }) => {
  test.setTimeout(360_000);
  mkdirSync(OUT_DIR, { recursive: true });
  page.setDefaultTimeout(20_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- Auth + seed -----------------------------------------------------------
  await signInTestUser(page);
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard/);

  const clerkUserId = await getClerkUserIdByEmail(TEST_USER.email);
  const profileId = await resolveProfileId(clerkUserId);

  await seedAnalyzedMatch(profileId);
  await seedMissingSkills(profileId);
  await seedRoadmap(profileId);
  await seedInterviewPrep(profileId);
  await seedResumeSuggestions();
  await seedDraftCv(profileId, { withPendingAwsBullet: true });
  await seedCoverLetter(profileId);
  const matchId = SEED.matchId;

  const results: string[] = [];

  async function captureAll(theme: "light" | "dark") {
    // Set the stored theme the layout's pre-paint script reads, on every nav.
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t as string);
      } catch {
        /* ignore */
      }
    }, theme);
    await page.emulateMedia({ colorScheme: theme });

    for (const shot of SHOTS) {
      const route = shot.path(matchId);
      const suffix = theme === "dark" ? "-dark" : "";
      const file = shot.file.replace(/\.png$/, `${suffix}.png`);
      const dest = resolve(OUT_DIR, file);
      try {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        if (shot.waitFor) {
          await page
            .getByText(shot.waitFor)
            .first()
            .waitFor({ state: "visible", timeout: 15_000 })
            .catch(() => {});
        }
        // Let fonts, images and entrance transitions settle.
        await page.waitForTimeout(1_200);
        await page.screenshot({ path: dest, fullPage: true });
        results.push(`OK    ${theme.padEnd(5)} ${file}  <- ${route}`);
      } catch (err) {
        results.push(`FAIL  ${theme.padEnd(5)} ${file}  <- ${route}  (${(err as Error).message})`);
      }
    }
  }

  try {
    await captureAll("light");
    await captureAll("dark");
  } finally {
    await teardownAnalyzedMatch(profileId);
  }

  console.log("\n=== Portfolio screenshot capture ===");
  console.log(`Output: ${OUT_DIR}`);
  for (const line of results) console.log(line);
  console.log("====================================\n");
});
