import { requireUser } from "@/lib/auth/require-user";
export default async function UserProfile({params}:{params:Promise<{userId:string}>}){
  await requireUser();
const {userId}=await params;return <><h1>Member profile</h1><p>Profile reference: <code>{userId}</code></p><p>TODO: load a real profile. This screen does not read the database yet.</p></>}
