import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";
export default async function Page() {
  await requireUser();

  redirect("/profile");
}
