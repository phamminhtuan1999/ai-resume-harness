import { AppShell } from "@/components/app-shell";
import { getWorkspaceProfile } from "@/lib/data/server";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appUser, profile } = await getWorkspaceProfile();

  return (
    <AppShell
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      {children}
    </AppShell>
  );
}
