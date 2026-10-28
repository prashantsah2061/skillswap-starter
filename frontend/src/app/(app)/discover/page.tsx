import { requireUser } from "@/lib/auth/require-user";
import { Discovery } from "@/components/demo/discovery";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  await requireUser();

  const { skill } = await searchParams;
  return <Discovery key={skill || "all"} initialSkill={skill} />;
}
