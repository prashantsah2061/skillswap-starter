import { requireUser } from "@/lib/auth/require-user";
import { Matches } from "@/components/demo/discovery";
export default async function Page() {
  await requireUser();

  return <Matches />;
}
