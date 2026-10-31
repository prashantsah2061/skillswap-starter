import { memberSession, reply } from "./community";
import { appOrigin } from "@/lib/auth/origin";
const MAX_BYTES = 5 * 1024 * 1024;
const bucket = "avatars";
// Decided from the file's bytes; its name and declared type are never trusted.
export function detectImage(b: Uint8Array) {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...b.subarray(start, end));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { ext: "jpg", type: "image/jpeg" };
  if (
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)
  )
    return { ext: "png", type: "image/png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return { ext: "webp", type: "image/webp" };
  return null;
}
export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== (await appOrigin()))
      return reply({ error: "Forbidden" }, 403);
    const s = await memberSession();
    if (!s) return reply({ error: "Please sign in again." }, 401);
    // Leaves room for multipart framing around a file at the limit.
    if (Number(req.headers.get("content-length")) > MAX_BYTES + 4096)
      return reply({ error: "Choose a picture under 5 MB." }, 413);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !file.size)
      return reply({ error: "Choose a picture to upload." }, 400);
    if (file.size > MAX_BYTES)
      return reply({ error: "Choose a picture under 5 MB." }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = detectImage(bytes);
    if (!image)
      return reply({ error: "Use a JPEG, PNG, or WebP picture." }, 415);
    // The ID comes from the verified session, never from the request.
    const path = `${s.user.id}/${crypto.randomUUID()}.${image.ext}`;
    const storage = s.supabase.storage.from(bucket);
    const upload = await storage.upload(path, bytes, {
      contentType: image.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (upload.error)
      return reply({ error: "Picture could not be uploaded." }, 503);
    const saved = await s.supabase.rpc("set_my_avatar", { p_path: path });
    if (saved.error) {
      await storage.remove([path]);
      return reply({ error: "Picture could not be saved." }, 503);
    }
    if (saved.data) await storage.remove([saved.data]);
    return reply({ avatar_url: storage.getPublicUrl(path).data.publicUrl });
  } catch {
    return reply({ error: "Picture could not be uploaded." }, 503);
  }
}
export async function DELETE(req: Request) {
  try {
    if (req.headers.get("origin") !== (await appOrigin()))
      return reply({ error: "Forbidden" }, 403);
    const s = await memberSession();
    if (!s) return reply({ error: "Please sign in again." }, 401);
    const saved = await s.supabase.rpc("set_my_avatar", { p_path: null });
    if (saved.error)
      return reply({ error: "Picture could not be removed." }, 503);
    if (saved.data) await s.supabase.storage.from(bucket).remove([saved.data]);
    return reply({ avatar_url: null });
  } catch {
    return reply({ error: "Picture could not be removed." }, 503);
  }
}
