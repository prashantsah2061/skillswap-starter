import { requireUser } from "@/lib/auth/require-user";
import { SessionRoom } from "@/components/demo/session-room";
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireUser();

  const { sessionId } = await params;
  return <SessionRoom id={sessionId} />;
}
