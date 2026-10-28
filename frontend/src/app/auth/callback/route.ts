import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/auth/origin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const signup = params.get("flow") === "signup" || params.get("type") === "signup" || params.get("error_code") === "otp_expired";
  const providerError = params.has("error") || params.has("error_code");
  // An email can be confirmed even when its PKCE verifier is unavailable in
  // this browser. Do not describe that as a failed registration.
  let destination = providerError
    ? (signup ? "/login?error=confirmation" : "/login?error=oauth")
    : "/login?notice=signin";

  try {
    const supabase = await createClient();
    if (code && !providerError) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) destination = "/dashboard";
    }
    if (destination !== "/dashboard") {
      // A reused email link must not disrupt an already valid session.
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) destination = "/dashboard";
    }
  } catch {
    // Keep a manual-sign-in fallback without exposing codes or provider errors.
  }

  const response = NextResponse.redirect(new URL(destination, await appOrigin()));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
