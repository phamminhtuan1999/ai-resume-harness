import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
    description: "For exploring ApplyWise.",
    features: ["Limited resume analysis", "Limited job match analysis", "Basic roadmap"],
  },
  {
    name: "Pro",
    description: "For serious AI role applications.",
    features: ["More job analyses", "Resume versions", "Interview prep", "Future exports"],
  },
] as const;

export default function PricingPage() {
  return (
    <AppShell active="Pricing">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Pricing</h1>
          <p className="text-sm text-muted-foreground">
            MVP pricing is a placeholder. No payment is processed.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.name}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Button variant={plan.name === "Pro" ? "default" : "outline"}>Coming soon</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

