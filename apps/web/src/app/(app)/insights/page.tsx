import { redirect } from "next/navigation";

// Insights merged into the unified dashboard (decision 0011 spirit: one home,
// decision-first). Kept as a redirect so existing links/bookmarks resolve.
export default function InsightsPage() {
  redirect("/dashboard");
}
