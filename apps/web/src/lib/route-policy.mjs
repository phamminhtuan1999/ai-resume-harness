export const protectedRoutePatterns = [
  "/dashboard(.*)",
  "/profile(.*)",
  "/resumes(.*)",
  "/jobs(.*)",
  "/matches(.*)",
  "/tracker(.*)",
  "/activity(.*)",
  "/settings(.*)",
];

const protectedPathPrefixes = [
  "/dashboard",
  "/profile",
  "/resumes",
  "/jobs",
  "/matches",
  "/tracker",
  "/activity",
  "/settings",
];

export function isApplyWiseProtectedPath(pathname) {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function needsClerkProxyForRequest({ method = "GET", pathname }) {
  return (
    isApplyWiseProtectedPath(pathname) ||
    (method === "POST" && pathname === "/pricing")
  );
}
