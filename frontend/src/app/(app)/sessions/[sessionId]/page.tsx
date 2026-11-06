import { requireUser } from "@/lib/auth/require-user";
import { Sessions } from "@/components/sessions/sessions";
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireUser();

  const { sessionId } = await params;
  return <Sessions selectedId={sessionId} />;
}
