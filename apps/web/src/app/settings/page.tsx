import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <AppShell active="Settings">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Account and data controls for the protected workspace.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Clerk account details will appear here after auth wiring.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">matthew@example.com</p>
            <Button variant="outline">Manage profile</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Data controls</CardTitle>
            <CardDescription>Deletion flows will be guarded by confirmation dialogs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row">
            <Button variant="destructive">Delete resume</Button>
            <Button variant="destructive">Delete job</Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

