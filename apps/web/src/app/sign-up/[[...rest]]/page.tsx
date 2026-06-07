import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
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

export default function SignUpPage() {
  if (hasClerkEnv()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <SignUp />
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
          <CardTitle>Create your ApplyWise account</CardTitle>
          <CardDescription>Clerk hosted auth will replace this placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/dashboard" className={buttonVariants()}>
            Start demo workspace
          </Link>
          <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
            I already have an account
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
