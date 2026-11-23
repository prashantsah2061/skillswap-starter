import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AccountProfile = { user_id: string; display_name: string; city: string; bio: string; avatar_url: string | null };
export const loadProfile = cache(async (): Promise<AccountProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_my_account_profile");
  if (error || !data?.[0]) return null;
  const profile = data[0];
  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;
  const { avatar_path: _avatarPath, ...accountProfile } = profile;
  return { ...accountProfile, avatar_url: avatarUrl };
});
