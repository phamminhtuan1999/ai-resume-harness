import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

import { hasClerkEnv } from "@/lib/env";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignInPage() {
  if (hasClerkEnv()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <SignIn />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <CardTitle>Sign in to ApplyWise</CardTitle>
          <CardDescription>Clerk hosted auth will replace this placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/dashboard" className={buttonVariants()}>
            Continue to dashboard
          </Link>
          <Link href="/sign-up" className={buttonVariants({ variant: "outline" })}>
            Create account
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
