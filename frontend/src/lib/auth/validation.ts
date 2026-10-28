import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254);
export const nameSchema = z.string().trim().min(1).max(80);
export const passwordSchema = z.string().refine(p => [...p].length >= 15, "Use at least 15 characters.").refine(p => new TextEncoder().encode(p).length <= 72, "Supabase accepts at most 72 UTF-8 bytes. Your password will never be truncated.");
export const registrationSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema, confirmPassword: z.string() }).refine(v => v.password === v.confirmPassword, { message: "Passwords don’t match.", path: ["confirmPassword"] });
export const profileSchema = z.object({ display_name: nameSchema, city: z.string().trim().max(80), bio: z.string().trim().max(500) }).strict();
export function initialDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const m = user.user_metadata || {};
  for (const value of [m.display_name, m.full_name, m.name, m.username]) {
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 80);
  }
  return user.email?.split("@")[0]?.slice(0, 80) || "New user";
}
