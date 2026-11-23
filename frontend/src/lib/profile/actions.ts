"use server";
import { revalidatePath } from "next/cache";
import { verifiedSession, mfaRequired } from "@/lib/auth/session";
import { checkActionOrigin } from "@/lib/auth/origin";
import { profileSchema } from "@/lib/auth/validation";
const avatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const avatarBucket = "avatars";

export async function uploadProfileAvatarAction(formData: FormData) {
  await checkActionOrigin();
  const session = await verifiedSession();
  if (!session || await mfaRequired(session)) return { error: "Please sign in again." };
  const file = formData.get("avatar");
  if (!(file instanceof File) || !avatarTypes.has(file.type) || file.size < 1 || file.size > 900 * 1024) {
    return { error: "Choose a JPG, PNG, or WebP image under 900 KB." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(file.type === "image/jpeg" && isJpeg) && !(file.type === "image/png" && isPng) && !(file.type === "image/webp" && isWebp)) {
    return { error: "That file is not a supported image." };
  }

  const { data: current, error: readError } = await session.supabase
    .from("account_profiles").select("avatar_path").eq("user_id", session.user.id).single();
  if (readError || !current) return { error: "Profile could not be updated. Please try again later." };
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await session.supabase.storage.from(avatarBucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (uploadError) return { error: "Photo could not be uploaded. Please try again." };

  const { error: updateError } = await session.supabase.from("account_profiles")
    .update({ avatar_path: path }).eq("user_id", session.user.id);
  if (updateError) {
    await session.supabase.storage.from(avatarBucket).remove([path]);
    return { error: "Photo could not be saved. Please try again." };
  }
  if (current.avatar_path?.startsWith(`${session.user.id}/`)) {
    await session.supabase.storage.from(avatarBucket).remove([current.avatar_path]);
  }
  const avatarUrl = session.supabase.storage.from(avatarBucket).getPublicUrl(path).data.publicUrl;
  revalidatePath("/", "layout");
  return { error: null, avatarUrl };
}

export async function saveProfileAction(input: unknown) {
  await checkActionOrigin();
  const session = await verifiedSession();
  if (!session || await mfaRequired(session)) return { error: "Please sign in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a name (1–80 characters), city (up to 80), and bio (up to 500)." };
  const { data, error } = await session.supabase.from("account_profiles").update(parsed.data).eq("user_id", session.user.id).select("user_id,display_name,city,bio,avatar_path").single();
  if (error || !data) return { error: "Profile could not be saved. Please try again later." };
  revalidatePath("/", "layout");
  const avatarUrl = data.avatar_path
    ? session.supabase.storage.from(avatarBucket).getPublicUrl(data.avatar_path).data.publicUrl
    : null;
  const { avatar_path: _avatarPath, ...profile } = data;
  return { error: null, profile: { ...profile, avatar_url: avatarUrl } };
}
