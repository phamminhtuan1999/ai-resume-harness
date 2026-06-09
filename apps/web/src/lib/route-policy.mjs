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
