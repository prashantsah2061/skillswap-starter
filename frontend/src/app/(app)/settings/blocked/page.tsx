import { requireUser } from "@/lib/auth/require-user";
import { BlockedMembers } from "@/components/safety/blocked-members";

export default async function Page() {
  await requireUser();
  return <BlockedMembers />;
}
