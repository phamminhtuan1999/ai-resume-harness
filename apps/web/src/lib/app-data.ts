import {
  Activity,
  BadgeDollarSign,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListChecks,
  Settings,
  Sparkles,
  Target,
  Upload,
  UserRound,
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Resumes", href: "/resumes", icon: FileText },
  { label: "Jobs", href: "/jobs", icon: BriefcaseBusiness },
  { label: "Analyzed Jobs", href: "/matches", icon: ListChecks },
  { label: "Tracker", href: "/tracker", icon: ClipboardList },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Pricing", href: "/pricing", icon: BadgeDollarSign },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

// Derives the active sidebar item from the current pathname. /profile and its
// subroutes are grouped under Settings in the nav.
export function isNavItemActive(
  pathname: string,
  item: { href: string; label: string }
) {
  if (item.label === "Settings" && pathname.startsWith("/profile")) {
    return true;
  }
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const quickActions = [
  { label: "Add resume", href: "/resumes/new", icon: Upload },
  { label: "Analyze match", href: "/matches/new", icon: Sparkles },
  { label: "View tracker", href: "/tracker", icon: Target },
] as const;

export const recentJobs = [
  {
    company: "Northstar AI",
    role: "Applied AI Engineer",
    status: "Saved",
    match: "74",
    contact: "Maya Chen",
  },
  {
    company: "Cobalt Systems",
    role: "LLM Platform Engineer",
    status: "Draft",
    match: "68",
    contact: "No contact",
  },
  {
    company: "Vertex Labs",
    role: "GenAI Backend Engineer",
    status: "Interviewing",
    match: "81",
    contact: "Alex Rivera",
  },
] as const;

export const resumeSources = [
  "PDF",
  "DOCX",
  "Image",
  "Markdown",
  "Plain text",
] as const;

export const profileFields = [
  { label: "Current role", value: "Software Engineer" },
  { label: "Experience", value: "4 years" },
  { label: "Target role", value: "AI Engineer" },
  { label: "Location", value: "US remote" },
] as const;

export const userSummary = {
  name: "Matthew",
  role: "Software Engineer",
  target: "AI Engineer",
  icon: UserRound,
};
