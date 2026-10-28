import { LoginScreen } from "@/components/auth/login-screen";
import "@/app/login-utilities.css";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  return <LoginScreen oauthError={error === "oauth"} confirmationError={error === "confirmation"} signInNotice={notice === "signin"} />;
}
