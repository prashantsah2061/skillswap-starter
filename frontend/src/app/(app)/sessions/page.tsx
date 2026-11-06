import { requireUser } from "@/lib/auth/require-user";
import { Sessions } from "@/components/sessions/sessions";
export default async function Page() {
  await requireUser();

  return <Sessions />;
}
