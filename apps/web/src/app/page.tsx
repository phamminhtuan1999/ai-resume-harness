import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Target,
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

const workflow = [
  {
    title: "Add resume and job",
    description: "Import a resume, paste a role, and keep contact details attached to the job.",
    icon: FileText,
  },
  {
    title: "Analyze fit honestly",
    description: "See strengths, missing skills, risks, and AI-readiness without invented evidence.",
    icon: ListChecks,
  },
  {
    title: "Improve before applying",
    description: "Generate safe suggestions, a Markdown draft, a 4-week roadmap, and interview prep.",
    icon: Target,
  },
  {
    title: "Track the application",
    description: "Save the job, link the match, and move it from saved to offer or archive.",
    icon: ClipboardList,
  },
] as const;

const proofPoints = [
  "Truth Guard blocks unsupported claims",
  "Roadmaps focus on real missing skills",
  "Tracker links jobs, matches, and contacts",
] as const;

function ProductScene() {
  return (
    <div
      aria-label="ApplyWise match analysis preview"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.922_0_0)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.922_0_0)_1px,transparent_1px)] bg-[size:44px_44px] opacity-55" />
      <div className="absolute right-[-80px] bottom-[-60px] hidden w-[720px] rotate-[-4deg] rounded-lg border bg-card/90 p-4 shadow-2xl md:block">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <p className="text-sm font-semibold">Applied AI Engineer match</p>
            <p className="text-xs text-muted-foreground">Harness Browser Resume · Meta</p>
          </div>
          <Badge variant="secondary">Possible match with gaps</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">Overall score</p>
            <p className="mt-2 text-5xl font-semibold">69</p>
            <div className="mt-4 h-2 rounded-full bg-secondary">
              <div className="h-2 w-[69%] rounded-full bg-primary" />
            </div>
            <div className="mt-4 grid gap-2 text-xs">
              <div className="flex justify-between">
                <span>AI readiness</span>
                <span>70</span>
              </div>
              <div className="flex justify-between">
                <span>Experience</span>
                <span>65</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              ["Strength", "Backend APIs and SQL production depth"],
              ["Missing skill", "RAG evaluation evidence"],
              ["Next step", "Build a retrieval evaluation proof project"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative flex min-h-[84vh] overflow-hidden border-b">
        <ProductScene />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 py-5 lg:px-6">
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <span className="text-sm font-semibold">ApplyWise</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/pricing" className={buttonVariants({ variant: "ghost" })}>
                Pricing
              </Link>
              <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
                Sign in
              </Link>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-10">
            <div className="max-w-2xl">
              <h1 className="text-5xl font-semibold tracking-normal text-balance md:text-7xl">
                ApplyWise
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                A career copilot for software engineers moving into AI, LLM, and applied AI roles.
                Analyze fit, improve honestly, and track each application from one private workspace.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
                  Start workspace
                  <ArrowRight data-icon="inline-end" />
                </Link>
                <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  View pricing
                </Link>
              </div>
              <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                {proofPoints.map((point) => (
                  <div key={point} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-10 md:grid-cols-4 lg:px-6">
        {workflow.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary">
                  <Icon className="size-4" />
                </div>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:grid-cols-[1fr_360px] lg:px-6">
          <div>
            <h2 className="text-2xl font-semibold">Apply now or improve first?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              ApplyWise keeps resume improvements tied to evidence already in your resume. When a
              skill is missing, it tells you what to build or practice before using that claim.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4" />
                MVP payment status
              </CardTitle>
              <CardDescription>
                Pricing is visible for SaaS positioning, but checkout is intentionally disabled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
                Pricing placeholder
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
