import { requireUser } from "@/lib/auth/require-user";
import { MemberProfile } from "@/components/demo/member";
export default async function UserProfile({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireUser();
  const { userId } = await params;
  return <MemberProfile key={userId} id={userId} />;
}
