import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { DashboardSummary } from "@/components/demo/dashboard";
export default async function Dashboard() {
  const user = await requireUser();
  // Every sign-in lands here, so new members go on to finish their profile.
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
  if (!error && !data?.onboarded) redirect("/profile");
  return <DashboardSummary />;
}
