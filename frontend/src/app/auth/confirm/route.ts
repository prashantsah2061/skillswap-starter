import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/auth/origin";
import { createClient } from "@/lib/supabase/server";

// Supports Supabase's SSR confirmation email template, including other devices.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let destination = "/login?error=confirmation";
  if (tokenHash && (type === "email" || type === "signup")) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) destination = "/dashboard";
    } catch {
      // Do not expose tokens or provider details in the redirect.
    }
  }
  const response = NextResponse.redirect(new URL(destination, await appOrigin()));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
