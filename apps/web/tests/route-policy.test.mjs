import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { isApplyWiseProtectedPath, protectedRoutePatterns } from "../src/lib/route-policy.mjs";

test("protected route policy covers authenticated app sections", () => {
  for (const pathname of [
    "/dashboard",
    "/dashboard/activity",
    "/profile",
    "/resumes",
    "/resumes/abc",
    "/jobs",
    "/jobs/abc",
    "/tracker",
    "/activity",
    "/settings",
  ]) {
    assert.equal(isApplyWiseProtectedPath(pathname), true, pathname);
  }
});

test("protected route policy leaves Clerk auth routes public", () => {
  for (const pathname of [
    "/",
    "/pricing",
    "/sign-in",
    "/sign-in/client-trust",
    "/sign-up",
    "/sign-up/verify-email-address",
  ]) {
    assert.equal(isApplyWiseProtectedPath(pathname), false, pathname);
  }
});

test("proxy exports Clerk-compatible protected route patterns", () => {
  assert.deepEqual(protectedRoutePatterns, [
    "/dashboard(.*)",
    "/profile(.*)",
    "/resumes(.*)",
    "/jobs(.*)",
    "/matches(.*)",
    "/tracker(.*)",
    "/activity(.*)",
    "/settings(.*)",
  ]);
});

test("Clerk sign-in and sign-up pages are catch-all routes", () => {
  const appDir = join(process.cwd(), "src", "app");

  assert.equal(existsSync(join(appDir, "sign-in", "[[...rest]]", "page.tsx")), true);
  assert.equal(existsSync(join(appDir, "sign-up", "[[...rest]]", "page.tsx")), true);
});
