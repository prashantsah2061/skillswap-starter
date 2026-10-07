import "server-only";
import { createClient } from "@/lib/supabase/server";
export async function getVerifiedUser(){const supabase=await createClient();const {data,error}=await supabase.auth.getUser();return {supabase,user:error?null:data.user};}
// API handlers should return 401 when user is null; page loaders may redirect to /login.
// Do not trust a user ID sent by the browser as the current user's identity.
