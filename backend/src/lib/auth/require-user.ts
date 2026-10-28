import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getVerifiedUser() {
  const supabase = await createClient();
  // getUser contacts Supabase Auth to validate the token and retrieve the user.
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

// API handlers should return 401 when user is null; page loaders may redirect.
// Never use a browser-supplied user ID or getSession() as proof of identity.
