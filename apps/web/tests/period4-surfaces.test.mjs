import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appDir = join(process.cwd(), "src", "app");

function readAppFile(path) {
  return readFileSync(join(appDir, path), "utf8");
}

test("home page is a public landing page instead of a dashboard redirect", () => {
  const source = readAppFile("page.tsx");

  assert.match(source, /ApplyWise/);
  assert.match(source, /Start workspace/);
  assert.doesNotMatch(source, /redirect\("\/dashboard"\)/);
});

test("pricing page sells credits without collecting payment details directly", () => {
  const source = readAppFile("pricing/page.tsx");

  assert.match(source, /Credits-first billing/);
  assert.match(source, /Credit packs/);
  assert.match(source, /startCreditCheckoutAction/);
  assert.doesNotMatch(source, /from ["']stripe["']/i);
  assert.doesNotMatch(source, /new Stripe/i);
  assert.doesNotMatch(source, /subscription/i);
  assert.doesNotMatch(source, /payment method/i);
});

test("public marketing headers resolve auth state instead of hardcoding sign-in", () => {
  for (const path of ["page.tsx", "pricing/page.tsx"]) {
    const source = readAppFile(path);
    assert.match(source, /MarketingAuthNav/, path);
    assert.match(source, /hasClerkEnv\(\)/, path);
  }

  const nav = readFileSync(
    join(process.cwd(), "src", "components", "marketing-auth-nav.tsx"),
    "utf8"
  );
  assert.match(nav, /useUser/);
  assert.match(nav, /Open dashboard/);
  assert.match(nav, /Sign in/);
});

test("settings page uses live account data and exposes real account deletion", () => {
  const source = readAppFile("(app)/settings/page.tsx");

  assert.match(source, /getWorkspaceData/);
  assert.match(source, /getTrackerData/);
  // Period 12 (US-056, decision 0016) replaced the "intentionally unavailable"
  // notice with a real typed-confirmation account deletion control.
  assert.doesNotMatch(source, /Deletion is intentionally unavailable/);
  assert.match(source, /DangerZoneCard/);
  assert.doesNotMatch(source, /matthew@example\.com/);
});
