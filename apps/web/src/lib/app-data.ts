import {
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
  { label: "Matches", href: "/matches", icon: ListChecks },
  { label: "Tracker", href: "/tracker", icon: ClipboardList },
  { label: "Pricing", href: "/pricing", icon: BadgeDollarSign },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export const quickActions = [
  { label: "Add Resume", href: "/resumes/new", icon: Upload },
  { label: "Analyze Match", href: "/matches/new", icon: Sparkles },
  { label: "View Tracker", href: "/tracker", icon: Target },
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
