import Link from "next/link";
import { CheckCircle2, Clock, HelpCircle } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { PendingPaymentRefresh } from "@/components/billing/pending-payment-refresh";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCreditPack, formatUsdFromCents } from "@/lib/billing-credits.mjs";
import { getCheckoutSessionSummary } from "@/lib/billing-stripe";

// This route stays outside the Clerk proxy (route-policy contract), so it
// renders from the Stripe session itself rather than the signed-in account.
// Copy never claims more than the session proves: a verified paid session gets
// "Payment received", a real-but-unconfirmed one gets in-progress copy that
// auto-refreshes, and an unknown or unverifiable session never earns the
// "finalizing" promise. Credits are granted only by the signed webhook —
// never by this page.
export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params?.session_id ?? "";
  const session = await getCheckoutSessionSummary(sessionId);
  const pack = session.packId ? getCreditPack(session.packId) : null;

  const copy = {
    paid: {
      title: "Payment received",
      description: session.credits
        ? `Your ${session.credits} ${pack?.name ?? ""} credits${
            session.amountTotalCents ? ` (${formatUsdFromCents(session.amountTotalCents)})` : ""
          } are being added to your balance now — Stripe's confirmation usually lands within a few seconds.`
        : "Your credits are being added to your balance now — Stripe's confirmation usually lands within a few seconds.",
    },
    pending: {
      title: "Finalizing your payment…",
      description:
        "Stripe is still confirming this payment. This page checks automatically; your credits are added the moment the confirmation lands.",
    },
    not_found: {
      title: "We couldn't find this checkout",
      description:
        "This link doesn't match a checkout session — it may be incomplete or expired. If you completed a payment, your Stripe receipt email confirms it and your credits are added automatically.",
    },
    unavailable: {
      title: "We can't verify this payment right now",
      description:
        "The payment itself isn't affected — credits are granted by Stripe's confirmation, not by this page. Check your balance in a moment, or keep your Stripe receipt as proof of purchase.",
    },
  }[session.status];

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 lg:px-6">
          <Link href="/" aria-label="ApplyWise home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        {session.status === "pending" ? <PendingPaymentRefresh /> : null}
        <Card className="rise">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {session.status === "paid" ? (
                <CheckCircle2 className="size-5 text-success" />
              ) : session.status === "pending" ? (
                <Clock className="size-5 text-muted-foreground" />
              ) : (
                <HelpCircle className="size-5 text-muted-foreground" />
              )}
              {copy.title}
            </CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          {session.status === "pending" ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Still waiting after a minute? You can close this page — credits land in your
                balance automatically. If they never arrive, reply to your Stripe receipt email
                and we&apos;ll make it right.
              </p>
            </CardContent>
          ) : null}
        </Card>
        <div className="rise rise-d1 flex flex-wrap gap-2">
          {session.status === "paid" ? (
            <>
              <Link href="/settings" className={buttonVariants()}>
                See your new balance
              </Link>
              <Link href="/matches" className={buttonVariants({ variant: "outline" })}>
                Open your analyzed jobs
              </Link>
            </>
          ) : (
            <>
              <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
                Check your balance
              </Link>
              <Link href="/matches" className={buttonVariants({ variant: "outline" })}>
                Open your analyzed jobs
              </Link>
            </>
          )}
          <Link href="/pricing" className={buttonVariants({ variant: "ghost" })}>
            Back to pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
