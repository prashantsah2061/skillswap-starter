"use server";
import { revalidatePath } from "next/cache";
import { verifiedSession, mfaRequired } from "@/lib/auth/session";
import { checkActionOrigin } from "@/lib/auth/origin";
import { profileSchema } from "@/lib/auth/validation";
export async function saveProfileAction(input: unknown) {
  await checkActionOrigin();
  const session = await verifiedSession();
  if (!session || await mfaRequired(session)) return { error: "Please sign in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a name (1–80 characters), city (up to 80), and bio (up to 500)." };
  const { data, error } = await session.supabase.from("account_profiles").update(parsed.data).eq("user_id", session.user.id).select("user_id,display_name,city,bio").single();
  if (error || !data) return { error: "Profile could not be saved. Please try again later." };
  revalidatePath("/", "layout");
  return { error: null, profile: data };
}
