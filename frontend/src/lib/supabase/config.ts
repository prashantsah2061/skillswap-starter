// Only public connection settings belong in this browser-safe module.
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Set Supabase URL and publishable key in frontend/.env.local first.");
  }

  if (!URL.canParse(url) || !["http:", "https:"].includes(new URL(url).protocol)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.");
  }

  // Reject secret/service-role keys before passing anything to a browser client.
  if (!key.startsWith("sb_publishable_")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key.");
  }

  return { url, key };
}
