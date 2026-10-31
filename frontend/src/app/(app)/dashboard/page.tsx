import { requireUser } from "@/lib/auth/require-user";
import { DashboardSummary } from "@/components/demo/dashboard";
export default async function Dashboard() {
  await requireUser();
  return <DashboardSummary />;
}
