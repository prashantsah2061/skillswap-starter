import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { verifiedSession, mfaRequired } from "./session";
export const requireUser = cache(async (allowMfaSetup = false) => {
  const session = await verifiedSession();
  if (!session) redirect("/login");
  if (!allowMfaSetup && await mfaRequired(session)) redirect("/mfa");
  return session.user;
});
