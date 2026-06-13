import Link from "next/link";
import { ArrowRight, CheckCircle2, Coins } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { BuyPackButton } from "@/components/billing/buy-pack-button";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  MarketingAuthLinks,
  MarketingAuthNav,
} from "@/components/marketing-auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startCreditCheckoutAction } from "@/lib/billing-actions";
import {
  CREDIT_ACTION_COSTS,
  CREDIT_PACKS,
  formatUsdFromCents,
} from "@/lib/billing-credits.mjs";
import { hasClerkEnv, hasStripeBillingEnv } from "@/lib/env";

const plans = [
  {
    name: "Free",
    description: "For exploring resume-to-job fit.",
    price: "$0",
    features: [
      "Career profile",
      "Resume and job intake",
      "Fit analysis for every job you add",
      "Tracker basics",
    ],
  },
] as const;

// Honest arithmetic from CREDIT_ACTION_COSTS: refresh (1) + tailored CV (3)
// = 4 credits per tailored application; the full prep loop adds cover letter,
// roadmap, and interview prep (+6) for 10 credits per job.
const packOutcomes: Record<string, string> = {
  starter: "Covers about 5 jobs end to end — a fresh analysis plus a tailored CV for each.",
  builder: "About 15 tailored applications, or 6 jobs with the full prep loop.",
  pro: "Roughly 37 tailored applications, or 15 jobs with the complete prep loop.",
};

// One honest default, not a "most popular" upsell: Builder covers a typical
// multi-week search (15 tailored applications) without Pro's commitment.
const RECOMMENDED_PACK_ID = "builder";

const billingFaqs = [
  {
    q: "When do credits arrive?",
    a: "Moments after payment. Stripe confirms the charge directly to ApplyWise and your balance updates as soon as that confirmation lands — usually a few seconds after checkout.",
  },
  {
    q: "Do credits expire?",
    a: "No. Your balance carries forward until you spend it.",
  },
  {
    q: "What if a generation fails?",
    a: "Tailored CVs, cover letters, roadmaps, and interview prep only charge after they finish. An analysis refresh charges when the run starts. If you are ever charged for a broken result, reply from your Stripe receipt email and we will restore the credits.",
  },
  {
    q: "Will action costs change?",
    a: "They may be tuned as features evolve — the table above is always current. Credits you already own never lose value: 1 credit is 1 credit.",
  },
] as const;

function centsPerCredit(priceCents: number, credits: number) {
  return Math.round(priceCents / credits);
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing?: string }>;
}) {
  const params = await searchParams;
  const billingEnabled = hasStripeBillingEnv();
  const billingStatus = params?.billing;

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 lg:px-6">
          <Link href="/" aria-label="ApplyWise home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {hasClerkEnv() ? <MarketingAuthNav /> : <MarketingAuthLinks />}
          </div>
        </div>
      </header>

      <section className="brand-radial border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-14 lg:px-6">
          <Badge className="rise w-fit" variant="secondary">
            Credits-first billing
          </Badge>
          <h1 className="rise rise-d1 max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Buy credits for focused AI job search work.
          </h1>
          <p className="rise rise-d2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pay once for credits and spend them only when you run paid AI work — no recurring
            charges. Checkout is hosted by Stripe; ApplyWise never collects card details.
          </p>
          {billingStatus === "setup-pending" ? (
            <p className="fade-in-up rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              Stripe billing is not configured in this environment yet.
            </p>
          ) : null}
          {billingStatus === "checkout-error" ? (
            <p className="fade-in-up rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Checkout could not start — your card was not charged. Try again in a moment.{" "}
              <Link href="/pricing" className="font-medium underline underline-offset-4">
                Dismiss
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-6">
        {/* Packs first in the DOM so the page's primary CTA leads on mobile;
            md:order-first keeps Free in the narrow column on desktop. */}
        <section className="rise rise-d3 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="size-4 text-brand" />
                Credit packs
              </CardTitle>
              <CardDescription>
                A credit is one unit of paid AI work — tailored CVs, cover letters, roadmaps,
                interview prep. Exact costs are in the table below; your first fit analysis of
                every job is free.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {CREDIT_PACKS.map((pack) => {
                const recommended = pack.id === RECOMMENDED_PACK_ID;
                const buyLabel = billingEnabled ? `Buy ${pack.name}` : "Checkout unavailable";
                return (
                  <form
                    key={pack.id}
                    action={startCreditCheckoutAction}
                    className={
                      recommended
                        ? "grid gap-3 rounded-lg border border-brand/45 bg-accent/40 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                        : "grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                    }
                  >
                    <input type="hidden" name="pack_id" value={pack.id} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Sora pack names: the one display-face moment this
                            brand-led surface earns below the hero. */}
                        <p className="font-display font-semibold">{pack.name}</p>
                        <Badge variant="secondary" className="tabular-nums">
                          {pack.credits} credits
                        </Badge>
                        {recommended ? (
                          <Badge className="bg-accent text-accent-foreground">Recommended</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {packOutcomes[pack.id] ?? pack.description}
                      </p>
                      {recommended ? (
                        // Verifiable reason, not an unsourced "most popular": the
                        // claim follows directly from the outcome line above.
                        <p className="mt-1 text-sm leading-6 text-accent-foreground">
                          Enough for a full multi-week search without topping up mid-hunt.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                      <p className="text-xl font-semibold tabular-nums">
                        {formatUsdFromCents(pack.priceCents)}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                          ≈ {centsPerCredit(pack.priceCents, pack.credits)}¢ per credit
                        </span>
                      </p>
                      {hasClerkEnv() ? (
                        <BuyPackButton disabled={!billingEnabled} label={buyLabel} />
                      ) : (
                        <SubmitButton
                          disabled={!billingEnabled}
                          pendingLabel="Opening Stripe checkout…"
                        >
                          {buyLabel}
                        </SubmitButton>
                      )}
                    </div>
                  </form>
                );
              })}
            </CardContent>
          </Card>
          {plans.map((plan) => (
            <Card key={plan.name} className="md:order-first">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{plan.price}</p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className={buttonVariants({ variant: "outline" })}>
                  Start workspace
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="reveal">
          <CardHeader>
            <CardTitle className="text-base">Credit costs</CardTitle>
            <CardDescription>
              What each paid action costs. Your first fit analysis for a job is included free —
              credits cover refreshes and the generators below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {CREDIT_ACTION_COSTS.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {item.credits} {item.credits === 1 ? "credit" : "credits"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <section className="reveal flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">Billing questions</h2>
          <div className="grid gap-2">
            {billingFaqs.map((faq) => (
              <details key={faq.q} className="group rounded-lg border bg-card px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" />
                </summary>
                <p className="details-content mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <Logo />
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
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
