// The E2E test user. Lives in the Clerk *development* instance (pk_test). The
// email is a Clerk test address (+clerk_test), so it needs no real inbox. The
// password is read from env so it is never committed — set E2E_CLERK_USER_PASSWORD
// in apps/web/.env (gitignored). See e2e/README.md.
export const TEST_USER = {
  email: process.env.E2E_CLERK_USER_EMAIL ?? "period11e2e+clerk_test@example.com",
  password: process.env.E2E_CLERK_USER_PASSWORD ?? "",
};

export function assertTestUserConfigured(): void {
  if (!TEST_USER.password) {
    throw new Error(
      "E2E_CLERK_USER_PASSWORD is not set. Add it to apps/web/.env (see e2e/README.md). " +
        "It must match the password of the Clerk test user " +
        `${TEST_USER.email}.`
    );
  }
}
