import { requireUser } from "@/lib/auth/require-user";
import { Messages } from "@/components/demo/messages";
export default async function Page() {
  await requireUser();

  return <Messages />;
}
