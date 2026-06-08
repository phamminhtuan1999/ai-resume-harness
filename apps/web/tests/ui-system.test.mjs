import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path) {
  return readFileSync(join(srcDir, path), "utf8");
}

test("shared UI system components exist for page headers and empty states", () => {
  assert.equal(existsSync(join(srcDir, "components", "page-header.tsx")), true);
  assert.equal(existsSync(join(srcDir, "components", "empty-state.tsx")), true);

  const pageHeader = readSource("components/page-header.tsx");
  const emptyState = readSource("components/empty-state.tsx");

  // Period 7: page titles use the Sora display face with tight tracking.
  assert.match(pageHeader, /font-display text-2xl font-semibold tracking-tight/);
  assert.match(pageHeader, /max-w-2xl text-sm leading-6 text-muted-foreground/);
  // Period 7: empty states keep the shared rounded-lg shape and a dashed default,
  // and now support intent variants (default / create / error).
  assert.match(emptyState, /rounded-lg border/);
  assert.match(emptyState, /border-dashed/);
  assert.match(emptyState, /variant/);
});

test("shared shape language uses rounded-lg across core primitives", () => {
  const card = readSource("components/ui/card.tsx");
  const badge = readSource("components/ui/badge.tsx");
  const table = readSource("components/ui/table.tsx");

  assert.match(card, /rounded-lg/);
  assert.doesNotMatch(card, /rounded-xl/);
  assert.match(badge, /rounded-lg/);
  assert.doesNotMatch(badge, /rounded-4xl/);
  assert.match(table, /rounded-lg border/);
});

test("primary workspace list pages use shared page headers and empty states", () => {
  for (const path of [
    "(app)/resumes/page.tsx",
    "(app)/jobs/page.tsx",
    "(app)/matches/page.tsx",
  ]) {
    const source = readSource(`app/${path}`);

    assert.match(source, /PageHeader/);
    assert.match(source, /EmptyState/);
  }
});
