import { requireUser } from "@/lib/auth/require-user";
import { Category } from "@/components/demo/explore";
export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  await requireUser();

  const { category } = await params;
  return <Category id={category} />;
}
