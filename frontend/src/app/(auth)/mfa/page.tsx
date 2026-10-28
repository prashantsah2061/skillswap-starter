import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { MfaScreen } from "@/components/auth/mfa-screen";
export default async function Page() {
  await requireUser(true);
  const { data } = await (await createClient()).auth.mfa.listFactors();
  return <MfaScreen factors={data?.totp.filter(f=>f.status === "verified") || []} />;
}
