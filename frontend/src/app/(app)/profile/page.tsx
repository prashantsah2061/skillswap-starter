import { requireUser } from "@/lib/auth/require-user";
import { AccountProfileScreen } from "@/components/auth/account-profile";
export default async function Page() { await requireUser(); return <AccountProfileScreen />; }
