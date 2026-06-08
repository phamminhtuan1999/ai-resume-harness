import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { hasClerkEnv } from "@/lib/env";
import { LogoMark } from "@/components/brand/logo";
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
      <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <SignIn />
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <LogoMark className="mb-2" />
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
