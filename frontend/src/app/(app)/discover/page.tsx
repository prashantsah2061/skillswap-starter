import { requireUser } from "@/lib/auth/require-user";
import { Discovery } from "@/components/discover/discovery";
export default async function Page() {
  await requireUser();

  return <Discovery />;
}
