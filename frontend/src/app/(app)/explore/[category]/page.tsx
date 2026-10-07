import { Category } from "@/components/demo/explore";
export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return <Category id={category} />;
}
