import "server-only";
import { createHash } from "node:crypto";
import { passwordSchema } from "./validation";

// Additional defense for the app's server actions. Enable Supabase's own leaked
// password protection too: direct calls to Auth must enforce the same policy.
export async function checkNewPassword(password: string): Promise<string | null> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0].message;
  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  try {
    // Only a 5-character hash prefix is sent. Never log the prefix or response.
    const response = await fetch(`https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return "Password safety checks are unavailable. Please try again later.";
    const lines = (await response.text()).split("\n");
    if (!lines.some(line => /^[A-F0-9]{35}:\d+\s*$/.test(line))) return "Password safety checks are unavailable. Please try again later.";
    const compromised = lines.some(line => {
      const [suffix, count] = line.trim().split(":");
      return suffix === digest.slice(5) && Number(count) > 0;
    });
    return compromised ? "This password appears in known data breaches. Choose a different passphrase." : null;
  } catch { return "Password safety checks are unavailable. Please try again later."; }
}
