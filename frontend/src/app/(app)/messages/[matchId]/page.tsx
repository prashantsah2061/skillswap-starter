import { requireUser } from "@/lib/auth/require-user";
import { Messages } from "@/components/demo/messages";
export default async function Page({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  await requireUser();

  const { matchId } = await params;
  return <Messages selectedId={matchId} />;
}
