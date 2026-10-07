import { Messages } from "@/components/demo/messages";
export default async function Page({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <Messages selectedId={matchId} />;
}
