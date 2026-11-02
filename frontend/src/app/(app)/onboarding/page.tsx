import { requireUser } from "@/lib/auth/require-user";
import { PublicOnboarding } from "@/components/discover/public-onboarding";
export default async function Page() {
  await requireUser();

  return <PublicOnboarding />;
}
