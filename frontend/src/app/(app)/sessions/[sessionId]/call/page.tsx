import { requireUser } from "@/lib/auth/require-user";
import { SessionCall } from "@/components/sessions/session-call";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireUser();
  const { sessionId } = await params;
  return <SessionCall sessionId={sessionId} />;
}
