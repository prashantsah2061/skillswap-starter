import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
export default async function Page() { await requireUser(true); redirect("/security"); }
