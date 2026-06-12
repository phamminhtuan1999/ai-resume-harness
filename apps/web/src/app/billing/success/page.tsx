import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BillingSuccessPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Link href="/" aria-label="ApplyWise home" className="w-fit">
          <Logo />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              Payment received
            </CardTitle>
            <CardDescription>
              Your credits are added after Stripe confirms the payment through
              the secure webhook. This usually completes in a few seconds.
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings" className={buttonVariants()}>
            View balance
          </Link>
          <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
            Back to pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
