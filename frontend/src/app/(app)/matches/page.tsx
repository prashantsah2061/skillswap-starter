import { requireUser } from "@/lib/auth/require-user";
import { Matches } from "@/components/matches/matches";
export default async function Page() {
  await requireUser();

  return <Matches />;
}
