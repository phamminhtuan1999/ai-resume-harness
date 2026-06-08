import Link from "next/link";
import { CheckCircle2, LockKeyhole } from "lucide-react";

import { Logo } from "@/components/brand/logo";
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

const plans = [
  {
    name: "Free",
    description: "For exploring resume-to-job fit.",
    price: "$0",
    features: ["Career profile", "Resume and job intake", "Limited match analysis", "Tracker basics"],
  },
  {
    name: "Pro",
    description: "For focused AI role applications.",
    price: "Coming soon",
    features: [
      "More job analyses",
      "Tailored Markdown resume drafts",
      "Roadmaps and interview prep",
      "Future exports after MVP",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 lg:px-6">
          <Link href="/" aria-label="ApplyWise home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={buttonVariants({ className: "hidden sm:inline-flex" })}
            >
              Start workspace
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 lg:px-6">
        <section className="flex flex-col gap-3">
          <Badge className="w-fit" variant="secondary">
            Payment disabled in MVP
          </Badge>
          <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Plans that grow with your search.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            ApplyWise shows Free and Pro positioning now, but the MVP does not collect payment
            details, start checkout, or create subscriptions.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
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
                <Button disabled variant={plan.name === "Pro" ? "default" : "outline"}>
                  Coming soon
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="size-4" />
              No checkout in MVP
            </CardTitle>
            <CardDescription>
              Upgrade controls are disabled placeholders. Real Stripe or payment processing is out
              of scope until the post-MVP billing story.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
