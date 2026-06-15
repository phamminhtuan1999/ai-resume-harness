import baseConfig from "./playwright.config";

// Opt-in config for the portfolio screenshot capture (e2e/screenshots.capture.ts).
// Kept OUT of the default `npm run test:e2e` run — the base config ignores
// *.capture.ts, and this config narrows testMatch to only the capture spec.
// It still depends on the `setup` project for the Clerk testing token.
//
// Run: npm run test:e2e:screens   (needs Node >= 22 for global WebSocket/fetch,
// the web + api dev servers running, and E2E_CLERK_USER_PASSWORD in .env)
export default {
  ...baseConfig,
  // Run ONLY the capture spec — and clear the base config's *.capture.ts ignore
  // (inherited via the spread) so it isn't filtered out here.
  testMatch: /screenshots\.capture\.ts$/,
  testIgnore: [],
};
