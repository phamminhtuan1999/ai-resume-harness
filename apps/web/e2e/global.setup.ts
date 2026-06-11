import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

// Fetches a Clerk Testing Token (using CLERK_SECRET_KEY) so the suite's sign-in
// flows bypass bot protection. Runs once before the chromium project.
setup("clerk testing token", async () => {
  await clerkSetup();
});
