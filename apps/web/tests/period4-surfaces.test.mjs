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

test("pricing page is a placeholder and does not start checkout", () => {
  const source = readAppFile("pricing/page.tsx");

  assert.match(source, /Payment disabled in MVP/);
  assert.match(source, /Coming soon/);
  assert.doesNotMatch(source, /from ["']stripe["']/i);
  assert.doesNotMatch(source, /new Stripe/i);
  assert.doesNotMatch(source, /checkoutSession/i);
  assert.doesNotMatch(source, /href=\{?["'].*checkout/i);
});

test("settings page uses live account data and avoids fake destructive controls", () => {
  const source = readAppFile("(app)/settings/page.tsx");

  assert.match(source, /getWorkspaceData/);
  assert.match(source, /getTrackerData/);
  assert.match(source, /Deletion is intentionally unavailable/);
  assert.doesNotMatch(source, /matthew@example\.com/);
  assert.doesNotMatch(source, /Delete resume/);
  assert.doesNotMatch(source, /Delete job/);
});
