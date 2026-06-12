import Link from "next/link";
import { CheckCircle2, Coins, LockKeyhole } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import {
  MarketingAuthLinks,
  MarketingAuthNav,
} from "@/components/marketing-auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
    features: ["Career profile", "Resume and job intake", "Limited match analysis", "Tracker basics"],
  },
] as const;

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing?: string }>;
}) {
  const params = await searchParams;
  const billingEnabled = hasStripeBillingEnv();
  const billingStatus = params?.billing;

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 lg:px-6">
          <Link href="/" aria-label="ApplyWise home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {hasClerkEnv() ? <MarketingAuthNav /> : <MarketingAuthLinks />}
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 lg:px-6">
        <section className="flex flex-col gap-3">
          <Badge className="w-fit" variant="secondary">
            Credits-first billing
          </Badge>
          <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Buy credits for focused AI job search work.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Keep the free workspace for tracking and buy credits when you are ready to run paid
            AI workflows. Checkout is hosted by Stripe; ApplyWise never collects card details.
          </p>
          {billingStatus === "setup-pending" ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
              Stripe billing is not configured in this environment yet.
            </p>
          ) : null}
          {billingStatus === "checkout-error" ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Checkout could not start. Try again or contact support.
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          {plans.map((plan) => (
            <Card key={plan.name}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                  <p className="text-xl font-semibold">{plan.price}</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="size-4" />
                Credit packs
              </CardTitle>
              <CardDescription>
                Prepaid credits for tailored CVs, cover letters, roadmaps, and interview prep.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {CREDIT_PACKS.map((pack) => (
                <form
                  key={pack.id}
                  action={startCreditCheckoutAction}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto]"
                >
                  <input type="hidden" name="pack_id" value={pack.id} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{pack.name}</p>
                      <Badge variant="secondary">{pack.credits} credits</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>
                  </div>
                  <Button type="submit" disabled={!billingEnabled}>
                    {billingEnabled ? `Buy ${formatUsdFromCents(pack.priceCents)}` : "Setup pending"}
                  </Button>
                </form>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="size-4" />
              Webhook-confirmed credits
            </CardTitle>
            <CardDescription>
              Checkout return pages do not grant credits. Credits are posted only after Stripe sends
              a signed payment confirmation webhook.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit costs</CardTitle>
            <CardDescription>
              Initial prices for paid AI actions. These are server-side spend rules as each workflow
              is gated.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {CREDIT_ACTION_COSTS.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.credits}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
