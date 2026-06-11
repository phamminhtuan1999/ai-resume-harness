// Resolve a Clerk user id from an email via the Clerk Backend API (no extra dep
// — just CLERK_SECRET_KEY). Used to map the signed-in test user to their
// user_profiles row for seeding.
export async function getClerkUserIdByEmail(email: string): Promise<string> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error("E2E needs CLERK_SECRET_KEY (apps/web/.env) to resolve the test user.");
  }
  const url = new URL("https://api.clerk.com/v1/users");
  url.searchParams.append("email_address", email);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) {
    throw new Error(`Clerk user lookup failed (${response.status}).`);
  }
  const users = (await response.json()) as Array<{ id: string }>;
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error(`No Clerk user found for ${email}. Create the test user first (see e2e/README.md).`);
  }
  return users[0].id;
}
