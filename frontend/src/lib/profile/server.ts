import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AccountProfile = { user_id: string; display_name: string; city: string; bio: string; avatar_url?: string | null };
export const loadProfile = cache(async (): Promise<AccountProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_my_account_profile");
  const row = data?.[0];
  if (error || !row) return null;
  const avatar_url = row.avatar_path ? supabase.storage.from("avatars").getPublicUrl(row.avatar_path).data.publicUrl : row.provider_avatar_url || null;
  return { user_id: row.user_id, display_name: row.display_name, city: row.city, bio: row.bio, avatar_url };
});
