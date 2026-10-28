import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AccountProfile = { user_id: string; display_name: string; city: string; bio: string };
export const loadProfile = cache(async (): Promise<AccountProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_my_account_profile");
  return error ? null : data?.[0] || null;
});
