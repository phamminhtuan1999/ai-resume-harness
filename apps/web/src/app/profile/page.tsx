import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { profileFields } from "@/lib/app-data";
import { saveProfileAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ProfilePage() {
  return (
    <AppShell active="Settings">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Career profile</h1>
          <p className="text-sm text-muted-foreground">
            This profile will tune analysis toward AI-focused engineering roles.
          </p>
        </div>
        <SetupNotice />
        <Card>
          <CardHeader>
            <CardTitle>Targeting</CardTitle>
            <CardDescription>Static shell for US-003 form wiring.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={saveProfileAction}
              className="grid gap-4 md:grid-cols-2"
            >
              <label className="flex flex-col gap-2 text-sm font-medium">
                Current role
                <Input name="current_role" defaultValue={profileFields[0].value} required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Years of experience
                <Input
                  name="years_of_experience"
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  defaultValue="4"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Target role
                <Input name="target_role" defaultValue={profileFields[2].value} required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Location preference
                <Input name="location_preference" defaultValue={profileFields[3].value} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                Technical background
                <Input
                  name="technical_background"
                  defaultValue="Backend, APIs, SQL, cloud deployment"
                />
              </label>
              <div className="md:col-span-2">
                <Button>Save profile</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
