import { z } from "zod";
import { verifiedSession, mfaRequired } from "@/lib/auth/session";
import { appOrigin } from "@/lib/auth/origin";
export const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const uuid = z.string().uuid();
type Db = NonNullable<Awaited<ReturnType<typeof verifiedSession>>>["supabase"];
const memberFields =
  "id,display_name,username,city,bio,visible,onboarded,avatar_path,provider_avatar_url";
// Members get one display URL: an uploaded picture, else the one from Google.
function withAvatar<
  T extends { avatar_path?: string | null; provider_avatar_url?: string | null },
>(db: Db, row: T) {
  const { avatar_path, provider_avatar_url, ...member } = row;
  return {
    ...member,
    avatar_url: avatar_path
      ? db.storage.from("avatars").getPublicUrl(avatar_path).data.publicUrl
      : provider_avatar_url || null,
  };
}
const selection = z.object({
  skill_id: uuid,
  direction: z.enum(["teach", "learn"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
});
const mutation = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("profile"),
    name: z.string().trim().min(1).max(80),
    username: z
      .union([z.literal(""), z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/)])
      .optional(),
    city: z.string().trim().max(80),
    bio: z.string().trim().max(500),
    visible: z.boolean(),
    selections: z.array(selection).max(100),
  }),
  z.object({
    op: z.literal("selection"),
    skill: uuid,
    direction: z.enum(["teach", "learn"]),
    level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
    remove: z.boolean().default(false),
  }),
  z.object({
    op: z.literal("swipe"),
    target: uuid,
    decision: z.enum(["like", "pass"]),
  }),
  z.object({
    op: z.literal("send"),
    match: uuid,
    id: uuid,
    body: z.string().trim().min(1).max(2000),
  }),
  z.object({ op: z.literal("read"), match: uuid, message: uuid }),
  z.object({
    op: z.literal("propose"),
    id: uuid,
    match: uuid,
    topic: z.string().trim().min(1).max(160),
    start: z.string().datetime({ offset: true }),
    duration: z.number().int().min(1).max(480),
    notes: z.string().max(2000),
    url: z.union([z.literal(""), z.url().startsWith("https://").max(2000)]),
  }),
  z.object({
    op: z.literal("transition"),
    id: uuid,
    status: z.enum(["accepted", "declined", "cancelled", "completed"]),
  }),
]);
export async function memberSession() {
  const s = await verifiedSession();
  if (!s || (await mfaRequired(s))) return null;
  const allowed = await s.supabase.rpc("account_session_allowed");
  return allowed.error || !allowed.data ? null : s;
}
async function postResponse(req: Request) {
  if (req.headers.get("origin") !== (await appOrigin()))
    return reply({ error: "Forbidden" }, 403);
  const s = await memberSession();
  if (!s) return reply({ error: "Please sign in again." }, 401);
  const text = await req.text();
  if (text.length > 24000) return reply({ error: "Request too large" }, 413);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  const parsed = mutation.safeParse(input);
  if (!parsed.success)
    return reply({ error: "Check the submitted fields." }, 400);
  const p = parsed.data;
  let rpc: string;
  let args: Record<string, unknown>;
  switch (p.op) {
    case "profile":
      rpc = "save_member";
      args = {
        p_name: p.name,
        p_city: p.city,
        p_bio: p.bio,
        p_visible: p.visible,
        p_skills: p.selections,
        p_username: p.username ?? null,
      };
      break;
    case "selection":
      rpc = "set_my_skill";
      args = {
        p_skill: p.skill,
        p_direction: p.direction,
        p_level: p.level,
        p_remove: p.remove,
      };
      break;
    case "swipe":
      rpc = "record_swipe";
      args = { p_target: p.target, p_decision: p.decision };
      break;
    case "send":
      rpc = "send_message";
      args = { p_match: p.match, p_id: p.id, p_body: p.body };
      break;
    case "read":
      rpc = "mark_read";
      args = { p_match: p.match, p_message: p.message };
      break;
    case "propose":
      rpc = "propose_session";
      args = {
        p_id: p.id,
        p_match: p.match,
        p_topic: p.topic,
        p_start: p.start,
        p_duration: p.duration,
        p_notes: p.notes,
        p_url: p.url,
      };
      break;
    case "transition":
      rpc = "transition_session";
      args = { p_id: p.id, p_status: p.status };
      break;
  }
  const { data, error } = await s.supabase.rpc(rpc, args);
  if (error) {
    const known = [
      "Invalid session transition",
      "An accepted booking overlaps for a participant",
      "Session start has passed",
      "Choose a future start time",
      "Member unavailable",
      "That username is already taken",
      "Complete your profile first",
    ];
    return reply(
      {
        error: known.includes(error.message)
          ? error.message
          : "Save failed. Check your input and try again.",
      },
      400,
    );
  }
  // PostgREST represents composite-returning RPCs as a one-row resource.
  return reply({
    data: p.op === "send" && Array.isArray(data) ? data[0] : data,
  });
}
async function getResponse(req: Request) {
  const s = await memberSession();
  if (!s) return reply({ error: "Please sign in again." }, 401);
  const db = s.supabase,
    q = new URL(req.url).searchParams,
    op = q.get("op") || "state";
  const checked = <T>(r: { data: T; error: unknown }) => {
    if (r.error) throw new Error("Database request failed");
    return r.data;
  };
  const id = (key: string) => uuid.parse(q.get(key));
  try {
    if (op === "skills")
      return reply(
        checked(
          await db
            .from("skills")
            .select("id,name,category_id")
            .order("name")
            .limit(1000),
        ),
      );
    if (op === "user-skills")
      return reply(
        checked(
          await db
            .from("user_skills")
            .select("skill_id,direction,level")
            .eq("user_id", s.user.id),
        ),
      );
    if (op === "me") {
      const me = checked(
        await db
          .from("profiles")
          .select(memberFields)
          .eq("id", s.user.id)
          .maybeSingle(),
      );
      return reply(me && withAvatar(db, me));
    }
    if (op === "state") {
      checked(await db.rpc("ensure_my_account_profile"));
      const results = await Promise.all([
        db
          .from("profiles")
          .select(`${memberFields},created_at,updated_at`)
          .eq("id", s.user.id)
          .single(),
        db
          .from("user_skills")
          .select("skill_id,direction,level")
          .eq("user_id", s.user.id),
        db
          .from("skills")
          .select("id,name,category_id")
          .order("name")
          .limit(1000),
        db.from("skill_categories").select("id,name").order("name"),
        db.rpc("member_counts"),
      ]);
      const [profile, selections, skills, categories, counts] =
        results.map(checked);
      return reply({
        userId: s.user.id,
        email: s.user.email || "",
        profile: withAvatar(db, profile as Parameters<typeof withAvatar>[1]),
        selections,
        skills,
        categories,
        counts,
      });
    }
    if (op === "discover") {
      const rows = checked(
        await db.rpc("discover_members", {
          p_after: q.get("after") ? id("after") : null,
          p_search: (q.get("search") || "").slice(0, 100),
          p_city: (q.get("city") || "").slice(0, 80),
          p_skill: q.get("skill") ? id("skill") : null,
          p_learning: q.get("learning") ? id("learning") : null,
          p_category: q.get("category") || null,
        }),
      );
      const ids = rows.map((r: { id: string }) => r.id);
      const selections = ids.length
        ? checked(
            await db
              .from("user_skills")
              .select("user_id,skill_id,direction,level")
              .in("user_id", ids),
          )
        : [];
      return reply(
        rows.map((r: { id: string; avatar_path: string | null }) => ({
          ...withAvatar(db, r),
          user_skills: (selections || []).filter(
            (x: { user_id: string }) => x.user_id === r.id,
          ),
        })),
      );
    }
    if (op === "member") {
      const member = checked(
        await db
          .from("profiles")
          .select(memberFields)
          .eq("id", id("id"))
          .maybeSingle(),
      );
      const skills = checked(
        await db
          .from("user_skills")
          .select("skill_id,direction,level")
          .eq("user_id", id("id")),
      );
      return reply(
        member ? { ...withAvatar(db, member), user_skills: skills } : null,
      );
    }
    if (op === "conversations") {
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(q.get("offset") || 0);
      const rows = checked(
        await db.rpc("conversation_page", { p_offset: offset }),
      );
      const ids = rows.map((r: { user_a: string; user_b: string }) =>
        r.user_a === s.user.id ? r.user_b : r.user_a,
      );
      const members = ids.length
        ? checked(
            await db
              .from("profiles")
              .select(memberFields)
              .in("id", ids),
          )
        : [];
      return reply(
        rows.map((r: { user_a: string; user_b: string }) => {
          const member = (members || []).find(
            (m: { id: string }) =>
              m.id === (r.user_a === s.user.id ? r.user_b : r.user_a),
          );
          return { ...r, member: member && withAvatar(db, member) };
        }),
      );
    }
    if (op === "conversation") {
      const row = checked(
        await db
          .from("matches")
          .select("id,user_a,user_b,created_at")
          .eq("id", id("match"))
          .maybeSingle(),
      );
      if (!row) return reply(null);
      const partner = row.user_a === s.user.id ? row.user_b : row.user_a;
      const member = checked(
        await db
          .from("profiles")
          .select(memberFields)
          .eq("id", partner)
          .maybeSingle(),
      );
      return reply({ ...row, member: member && withAvatar(db, member) });
    }
    if (op === "messages") {
      let query = db
        .from("messages")
        .select("id,match_id,sender_id,body,created_at")
        .eq("match_id", id("match"))
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(40);
      if (q.get("before")) {
        const date = z
          .string()
          .datetime({ offset: true })
          .parse(q.get("before"));
        const cursor = id("cursor");
        query = query.or(
          `created_at.lt.${date},and(created_at.eq.${date},id.lt.${cursor})`,
        );
      }
      return reply(checked(await query));
    }
    if (op === "sessions" || op === "session") {
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(q.get("offset") || 0);
      const rows =
        op === "sessions"
          ? checked(
              await db.rpc("session_page", {
                p_offset: offset,
                p_history: q.get("history") === "true",
              }),
            )
          : [
              checked(
                await db
                  .from("sessions")
                  .select("*")
                  .eq("id", id("id"))
                  .maybeSingle(),
              ),
            ].filter(Boolean);
      const matchIds = rows.map((row: { match_id: string }) => row.match_id);
      const matches = matchIds.length
        ? checked(
            await db
              .from("matches")
              .select("id,user_a,user_b")
              .in("id", matchIds),
          ) || []
        : [];
      const partnerIds = matches.map((m) =>
        m.user_a === s.user.id ? m.user_b : m.user_a,
      );
      const partners = partnerIds.length
        ? checked(
            await db
              .from("profiles")
              .select("id,display_name")
              .in("id", partnerIds),
          ) || []
        : [];
      const decorated = rows.map((row: { match_id: string }) => {
        const match = matches.find((m) => m.id === row.match_id);
        const partnerId =
          match?.user_a === s.user.id ? match.user_b : match?.user_a;
        return { ...row, partner: partners.find((p) => p.id === partnerId) };
      });
      return reply(op === "sessions" ? decorated : decorated[0] || null);
    }
    return reply({ error: "Unknown operation" }, 400);
  } catch (e) {
    return reply(
      {
        error:
          e instanceof z.ZodError
            ? "Invalid query."
            : "Data could not be loaded. Please retry.",
      },
      e instanceof z.ZodError ? 400 : 503,
    );
  }
}

// Auth/network outages return the same private JSON envelope as query failures.
export async function GET(req: Request) {
  try {
    return await getResponse(req);
  } catch {
    return reply(
      { error: "Data is temporarily unavailable. Please retry." },
      503,
    );
  }
}
export async function POST(req: Request) {
  try {
    return await postResponse(req);
  } catch {
    return reply({ error: "Save could not be confirmed. Please retry." }, 503);
  }
}
