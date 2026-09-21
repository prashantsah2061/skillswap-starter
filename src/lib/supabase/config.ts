export function getSupabaseConfig(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url || !key) throw new Error("Set Supabase URL and publishable key in .env.local first.");
 return {url,key};
}
