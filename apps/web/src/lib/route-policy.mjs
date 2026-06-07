export const protectedRoutePatterns = [
  "/dashboard(.*)",
  "/profile(.*)",
  "/resumes(.*)",
  "/jobs(.*)",
  "/matches(.*)",
  "/tracker(.*)",
  "/settings(.*)",
];

const protectedPathPrefixes = [
  "/dashboard",
  "/profile",
  "/resumes",
  "/jobs",
  "/matches",
  "/tracker",
  "/settings",
];

export function isApplyWiseProtectedPath(pathname) {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
