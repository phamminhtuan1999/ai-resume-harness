import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileSearch,
  ListChecks,
  Map,
  ShieldCheck,
  Sparkle,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/brand/logo";
import {
  MarketingAuthLinks,
  MarketingAuthNav,
} from "@/components/marketing-auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasClerkEnv } from "@/lib/env";

const targetRoles = [
  "AI Engineer",
  "Applied AI Engineer",
  "LLM Engineer",
  "GenAI Engineer",
  "ML Platform Engineer",
] as const;

const steps = [
  {
    icon: FileSearch,
    title: "Add a resume and a target role",
    body: "Import a resume, then paste or fetch a job. Recruiter and contact details stay attached to the job.",
  },
  {
    icon: ListChecks,
    title: "See an honest fit analysis",
    body: "Strengths, missing skills, risks, and AI readiness, scored without inventing evidence you do not have.",
  },
  {
    icon: Map,
    title: "Improve before you apply",
    body: "Evidence-backed resume suggestions, a tailored draft, a focused 4-week roadmap, and interview prep.",
  },
  {
    icon: ClipboardList,
    title: "Track every application",
    body: "Save the job, link the analysis, and move it from saved to offer in one private workspace.",
  },
] as const;

const faqs = [
  {
    q: "Will it invent experience I do not have?",
    a: "No. Truth Guard ties every suggestion to evidence already in your resume. Missing skills become a plan to build, not a fabricated claim.",
  },
  {
    q: "Which roles is it built for?",
    a: "AI, Applied AI, LLM, GenAI, and ML platform engineering roles for software engineers with roughly two to six years of experience.",
  },
  {
    q: "Does it auto-apply to jobs?",
    a: "No. ApplyWise helps you decide and prepare. You stay in control of what gets sent and where.",
  },
  {
    q: "Is my workspace private?",
    a: "Yes. Resumes, jobs, analyses, and contacts live in a workspace scoped to your account.",
  },
] as const;

function MatchPreview() {
  // Illustrative product preview built from the real UI primitives (not a stock
  // screenshot). Numbers are sample data that show what the analysis looks like.
  return (
    <Card
      aria-label="Sample match analysis"
      className="rise rise-d2 w-full gap-4 shadow-xl shadow-primary/5"
    >
      <CardHeader className="border-b [.border-b]:pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">Applied AI Engineer</CardTitle>
            <CardDescription className="truncate">
              Northstar AI · Primary resume
            </CardDescription>
          </div>
          <Badge variant="warning">Possible match, with gaps</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Overall fit</p>
          <p className="mt-1 font-display text-4xl font-semibold tabular-nums">72</p>
          <div className="mt-3 grid gap-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">AI readiness</span>
              <span className="tabular-nums">70</span>
            </div>
            <Progress value={70} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Experience</span>
              <span className="tabular-nums">65</span>
            </div>
            <Progress value={65} />
          </div>
        </div>
        <div className="grid gap-2.5">
          {[
            ["Strength", "Production backend APIs and SQL depth", "success"],
            ["Missing skill", "Retrieval evaluation evidence", "warning"],
            ["Next step", "Build a small retrieval-eval project", "info"],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border p-3">
              <Badge variant={tone as "success" | "warning" | "info"}>
                {label}
              </Badge>
              <p className="mt-1.5 text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TruthGuardPreview() {
  return (
    <Card aria-label="Truth Guard preview" className="w-full gap-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <ShieldCheck className="size-4 text-brand" />
        <span className="text-sm font-medium">Truth Guard</span>
      </div>
      <div className="grid gap-3 p-4">
        <div className="rounded-lg border border-success/30 bg-success/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Kept</span>
            <Badge variant="success">Evidence found</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Built a RAG service on Postgres and pgvector for internal search.
          </p>
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Held back</span>
            <Badge variant="warning">No evidence yet</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            &ldquo;Expert in LLM evaluation&rdquo; needs a project first. Here is
            what to build.
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 lg:px-6">
          <Logo />
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/pricing"
              className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}
            >
              Pricing
            </Link>
            <ThemeToggle />
            {hasClerkEnv() ? <MarketingAuthNav /> : <MarketingAuthLinks />}
          </nav>
        </div>
      </header>

      {/* Hero: asymmetric split with a real component preview. */}
      <section className="brand-radial relative border-b">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:px-6 lg:py-24">
          <div className="max-w-xl">
            <span className="rise inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkle className="size-3.5 text-brand" />
              AI career copilot for engineers
            </span>
            <h1 className="rise rise-d1 mt-5 font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              Apply now, or improve first?
            </h1>
            <p className="rise rise-d2 mt-5 max-w-md text-lg leading-8 text-muted-foreground">
              ApplyWise scores your fit for AI engineering roles, shows what is
              missing, and helps you fix it before you apply.
            </p>
            <div className="rise rise-d3 mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
                Start workspace
                <ArrowRight data-icon="inline-end" />
              </Link>
              <Link
                href="/pricing"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                View pricing
              </Link>
            </div>
          </div>
          <div className="lg:pl-4">
            <MatchPreview />
          </div>
        </div>
      </section>

      {/* Target-role strip. */}
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:gap-8 lg:px-6">
          <p className="shrink-0 text-sm font-medium text-muted-foreground">
            Tuned for roles like
          </p>
          <div className="flex flex-wrap gap-2">
            {targetRoles.map((role) => (
              <span
                key={role}
                className="rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-sm"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works: sticky intro + connected step list (distinct layout). */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 lg:px-6 lg:py-24">
        <div className="reveal grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance">
              One honest loop, four steps
            </h2>
            <p className="mt-3 max-w-sm text-muted-foreground">
              The same workspace takes you from a raw resume to a tracked
              application, without guesswork.
            </p>
          </div>
          <ol className="flex flex-col">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="flex gap-4 border-t py-6 first:border-t-0 first:pt-0"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
                    <Icon className="size-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        0{index + 1}
                      </span>
                      <h3 className="font-medium">{step.title}</h3>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Truth Guard: split feature with the second component preview. */}
      <section className="border-y bg-card">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:px-6 lg:py-24">
          <div className="reveal order-2 lg:order-1">
            <TruthGuardPreview />
          </div>
          <div className="reveal order-1 max-w-md lg:order-2">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance">
              Suggestions you can defend in the room
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              ApplyWise keeps every resume edit tied to evidence already in your
              resume. When a skill is missing, it tells you what to build or
              practice instead of writing a claim you cannot back up.
            </p>
            <Link
              href="/sign-up"
              className={buttonVariants({ variant: "outline", className: "mt-6" })}
            >
              Start workspace
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </div>
      </section>

      {/* Signature decision band. */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 lg:px-6 lg:py-24">
        <div className="reveal">
          <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Every analysis answers one question.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="gap-2 border-success/30 bg-success/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="size-4 text-brand" />
                  Apply now
                </CardTitle>
                <CardDescription className="text-foreground/70">
                  Fit is strong. Generate a tailored draft and interview prep,
                  then track it from saved to offer.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="gap-2 border-warning/40 bg-warning/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="size-4 text-[oklch(0.55_0.12_70)] dark:text-warning" />
                  Improve first
                </CardTitle>
                <CardDescription className="text-foreground/70">
                  Gaps are real. Get a focused 4-week roadmap to close the
                  missing skills before you spend an application.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing teaser + primary CTA band. */}
      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 lg:px-6">
          <div className="reveal brand-radial flex flex-col items-start gap-6 rounded-2xl border p-8 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-lg">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-balance md:text-3xl">
                Start free. Upgrade when it pays off.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Build your workspace today. Pro positioning is visible now, with
                checkout intentionally disabled during the MVP.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
                Start workspace
                <ArrowRight data-icon="inline-end" />
              </Link>
              <Link
                href="/pricing"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ via native disclosure (no JS). */}
      <section className="mx-auto w-full max-w-3xl px-4 py-16 lg:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Questions, answered honestly
        </h2>
        <div className="mt-6 divide-y border-t">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" />
              </summary>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <Logo />
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Start workspace
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
