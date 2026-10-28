import { requireUser } from "@/lib/auth/require-user";
import { Explore } from "@/components/demo/explore";

export default async function Dashboard() {
  await requireUser();
  return <Explore />;
}
