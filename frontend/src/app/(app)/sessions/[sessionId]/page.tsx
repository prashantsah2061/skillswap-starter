import { SessionRoom } from "@/components/demo/session-room";
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SessionRoom id={sessionId} />;
}
