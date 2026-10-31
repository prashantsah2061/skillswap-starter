const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const { loadTs } = require("./load-ts.cjs");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const file = (owner, n, ext = "png") =>
  `${uid(owner)}/20000000-0000-4000-8000-${String(n).padStart(12, "0")}.${ext}`;
const google = "https://lh3.googleusercontent.com/a/photo";
const migrated = "202610300001_member_identity.sql";

async function database(beforeIdentity = async () => {}) {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));create table auth.mfa_factors(user_id uuid,status text);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create schema storage;grant usage on schema storage to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,owner_id text default (auth.uid())::text);
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for (const name of fs.readdirSync("backend/supabase/migrations").sort()) {
    if (name === migrated) await beforeIdentity(db);
    await db.exec(fs.readFileSync("backend/supabase/migrations/" + name, "utf8"));
  }
  await db.exec(fs.readFileSync("backend/supabase/catalog/skills.sql", "utf8"));
  const addUser = async (n, meta = {}, email = `member${n}@example.test`) => {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",
      [uid(n), email, JSON.stringify(meta)],
    );
    await db.query("insert into auth.sessions values($1,$2)", [sid(n), uid(n)]);
  };
  const as = async (n) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(n), session_id: sid(n), aal: "aal1" }),
    ]);
    await db.exec("set role authenticated");
  };
  const call = async (sql, args = []) => (await db.query(sql, args)).rows;
  await db.exec("reset role");
  const [{ id: skill }] = await call("select id from public.skills where name='Cooking'");
  const both = JSON.stringify([
    { skill_id: skill, direction: "teach", level: "advanced" },
    { skill_id: skill, direction: "learn", level: "beginner" },
  ]);
  const complete = (n) =>
    call("select public.save_member($1,'','A real bio',true,$2)", [`Member ${n}`, both]);
  return { db, addUser, as, call, skill, both, complete };
}

test("Google signup fills name, email and picture once; returning sign-ins never overwrite edits", async () => {
  const { db, addUser, as, call, both } = await database();
  try {
    await addUser(1, { full_name: "Real Google Name", picture: google }, "real@gmail.example");
    await as(1);
    const [first] = await call("select * from public.ensure_my_account_profile()");
    assert.equal(first.display_name, "Real Google Name");
    assert.equal(first.email, "real@gmail.example");
    assert.equal(first.provider_avatar_url, google);
    // A new account is hidden and unfinished until the member completes it.
    const [fresh] = await call("select visible,onboarded from public.profiles where id=$1", [uid(1)]);
    assert.deepEqual(fresh, { visible: false, onboarded: false });

    await call("select public.save_member('Chosen name','Pune','My bio',true,$1,'Chosen_Name')", [both]);
    await call("select public.ensure_my_account_profile()");
    const [saved] = await call("select display_name,username,bio,city from public.account_profiles");
    assert.deepEqual(saved, { display_name: "Chosen name", username: "chosen_name", bio: "My bio", city: "Pune" });

    // A removed Google picture must not come back at the next sign-in.
    await call("select public.set_my_avatar(null)");
    await call("select public.ensure_my_account_profile()");
    const [row] = await call("select provider_avatar_url,avatar_path from public.profiles where id=$1", [uid(1)]);
    assert.deepEqual(row, { provider_avatar_url: null, avatar_path: null });
  } finally {
    await db.close();
  }
});

test("only Google-hosted pictures are accepted from editable account metadata", async () => {
  const { db, addUser, as, call } = await database();
  try {
    await addUser(1, { full_name: "A", avatar_url: "https://attacker.example/pixel.png" });
    await addUser(2, { full_name: "B", picture: "https://evil.googleusercontent.com.attacker.example/x" });
    await addUser(3, { full_name: "C", picture: "http://lh3.googleusercontent.com/insecure" });
    for (const n of [1, 2, 3]) {
      await as(n);
      const [row] = await call("select * from public.ensure_my_account_profile()");
      assert.equal(row.provider_avatar_url, null);
    }
  } finally {
    await db.close();
  }
});

test("email/password signup creates a profile without using the email as a public name", async () => {
  const { db, addUser, as, call } = await database();
  try {
    await addUser(1, { display_name: "Typed Name" }, "typed@example.test");
    await addUser(2, {}, "secretaddress@example.test");
    await as(1);
    assert.equal((await call("select * from public.ensure_my_account_profile()"))[0].display_name, "Typed Name");
    await as(2);
    const [row] = await call("select * from public.ensure_my_account_profile()");
    assert.equal(row.display_name, "New member");
    assert.equal(row.email, "secretaddress@example.test");
    // Exactly one profile per Auth user, however many times this runs.
    await call("select public.ensure_my_account_profile()");
    assert.equal((await call("select * from public.account_profiles")).length, 1);
  } finally {
    await db.close();
  }
});

test("completion rule: incomplete members can't appear in Discover or like anyone", async () => {
  const { db, addUser, as, call, skill, both, complete } = await database();
  try {
    for (const n of [1, 2]) await addUser(n, { full_name: "Member " + n });
    await as(2);
    await complete(2);
    await as(1);
    const steps = [
      ["", "[]"],
      ["A bio", "[]"],
      ["A bio", JSON.stringify([{ skill_id: skill, direction: "teach", level: "beginner" }])],
      ["", both],
    ];
    for (const [bio, skills] of steps) {
      await call("select public.save_member('Me','',$1,true,$2)", [bio, skills]);
      const [me] = await call("select onboarded from public.profiles where id=$1", [uid(1)]);
      assert.equal(me.onboarded, false, `bio=${bio} skills=${skills}`);
      await as(2);
      assert.equal((await call("select * from public.discover_members()")).length, 0);
      await as(1);
      await assert.rejects(
        () => call("select public.record_swipe($1,'like')", [uid(2)]),
        /Complete your profile first/,
      );
    }
    await complete(1);
    await as(2);
    const found = await call("select * from public.discover_members()");
    assert.deepEqual(found.map((m) => m.id), [uid(1)]);
    assert.equal("email" in found[0], false);
    // Never lists yourself.
    assert.equal(found.some((m) => m.id === uid(2)), false);
    // Removing the last skill takes a member back out of Discover.
    await as(1);
    await call("select public.set_my_skill($1,'learn','beginner',true)", [skill]);
    await as(2);
    assert.equal((await call("select * from public.discover_members()")).length, 0);
    await as(1);
    await call("select public.set_my_skill($1,'learn','beginner',false)", [skill]);
    // Opting out hides a complete profile.
    await call("select public.save_member('Me','','A bio',false,$1)", [both]);
    await as(2);
    assert.equal((await call("select * from public.discover_members()")).length, 0);
  } finally {
    await db.close();
  }
});

test("usernames are unique regardless of case, validated, and kept when not supplied", async () => {
  const { db, addUser, as, call, both } = await database();
  try {
    for (const n of [1, 2]) await addUser(n, { full_name: "Member " + n });
    await as(1);
    await call("select public.save_member('A','','Bio',true,$1,'skill_fan')", [both]);
    await as(2);
    await assert.rejects(
      () => call("select public.save_member('B','','Bio',true,$1,'SKILL_FAN')", [both]),
      /already taken/,
    );
    for (const bad of ["ab", "has space", "<script>", "x".repeat(31)])
      await assert.rejects(() => call("select public.save_member('B','','Bio',true,$1,$2)", [both, bad]));
    await as(1);
    await call("select public.save_member('A2','','Bio',true,$1)", [both]);
    assert.equal((await call("select username from public.account_profiles"))[0].username, "skill_fan");
    await call("select public.save_member('A2','','Bio',true,$1,'')", [both]);
    assert.equal((await call("select username from public.account_profiles"))[0].username, null);
  } finally {
    await db.close();
  }
});

test("members can't change another member's profile, skills, or picture, or read private data", async () => {
  const { db, addUser, as, call, skill, complete } = await database();
  try {
    for (const n of [1, 2]) await addUser(n, { full_name: "Member " + n });
    await as(2);
    await complete(2);
    await as(1);
    await complete(1);
    assert.equal((await call("update public.account_profiles set bio='hacked' where user_id=$1 returning *", [uid(2)])).length, 0);
    assert.deepEqual((await call("select user_id from public.account_profiles")).map((r) => r.user_id), [uid(1)]);
    const denied = [
      ["update public.profiles set bio='hacked' where id=$1", [uid(2)]],
      ["update public.profiles set avatar_path='x' where id=$1", [uid(2)]],
      ["delete from public.profiles where id=$1", [uid(2)]],
      ["insert into public.user_skills(user_id,skill_id,direction) values($1,$2,'teach')", [uid(2), skill]],
      ["delete from public.user_skills where user_id=$1", [uid(2)]],
      ["update public.account_profiles set username='stolen',avatar_path=null where user_id=$1", [uid(1)]],
      ["update public.account_profiles set email='x@y.z' where user_id=$1", [uid(1)]],
    ];
    for (const [sql, args] of denied)
      await assert.rejects(() => call(sql, args), /permission denied/, sql);
    await db.exec("reset role");
    assert.equal((await call("select bio from public.profiles where id=$1", [uid(2)]))[0].bio, "A real bio");
    assert.equal((await call("select count(*)::int c from public.user_skills where user_id=$1", [uid(2)]))[0].c, 2);
  } finally {
    await db.close();
  }
});

test("storage policies: owners manage only their own folder, and pictures can't be claimed", async () => {
  const { db, addUser, as, call } = await database();
  try {
    for (const n of [1, 2]) await addUser(n, { full_name: "Member " + n });
    const put = (name) => call("insert into storage.objects(bucket_id,name) values('avatars',$1)", [name]);
    await as(1);
    await put(file(1, 1));
    await assert.rejects(() => put(file(2, 2)), /row-level security/, "another member's folder");
    await assert.rejects(() => put(`${uid(1)}/page.html`), /row-level security/, "wrong file type");
    await assert.rejects(() => put(`${uid(1)}/../${uid(2)}/20000000-0000-4000-8000-000000000001.png`), /row-level security/, "path traversal");
    await assert.rejects(() => call("insert into storage.objects(bucket_id,name) values('other',$1)", [file(1, 3)]), /row-level security/, "other bucket");
    await as(2);
    await put(file(2, 2));
    assert.deepEqual((await call("select name from storage.objects")).map((r) => r.name), [file(2, 2)], "can't list others");
    assert.equal((await call("delete from storage.objects where name=$1 returning name", [file(1, 1)])).length, 0);
    await assert.rejects(() => call("select public.set_my_avatar($1)", [file(1, 1)]), /Invalid picture/, "someone else's file");
    await assert.rejects(() => call("select public.set_my_avatar($1)", [file(2, 9)]), /Invalid picture/, "file that doesn't exist");
    assert.equal((await call("select public.set_my_avatar($1) as old", [file(2, 2)]))[0].old, null);
    await put(file(2, 3));
    assert.equal((await call("select public.set_my_avatar($1) as old", [file(2, 3)]))[0].old, file(2, 2));
    await as(1);
    assert.equal((await call("select avatar_path from public.profiles where id=$1", [uid(2)])).length, 0);
    await db.exec("reset role");
    assert.equal((await call("select avatar_path from public.profiles where id=$1", [uid(2)]))[0].avatar_path, file(2, 3));
    const [bucket] = await call("select * from storage.buckets where id='avatars'");
    assert.equal(bucket.file_size_limit, 5242880);
    assert.deepEqual(bucket.allowed_mime_types, ["image/jpeg", "image/png", "image/webp"]);
  } finally {
    await db.close();
  }
});

test("full journey: two real members discover, mutually like, match, and message; a third can't read it", async () => {
  const { db, addUser, as, call, complete } = await database();
  try {
    for (const n of [1, 2, 3]) await addUser(n, { full_name: "Member " + n });
    for (const n of [1, 2, 3]) {
      await as(n);
      await complete(n);
    }
    await as(1);
    assert.deepEqual((await call("select id from public.discover_members() order by id")).map((m) => m.id), [uid(2), uid(3)]);
    // One-sided interest is not a match, and the actor always comes from the session.
    assert.equal((await call("select public.record_swipe($1,'like') as m", [uid(2)]))[0].m, null);
    assert.equal((await call("select * from public.matches")).length, 0);
    await db.exec("reset role");
    const [swipe] = await call("select actor_id from public.swipes");
    assert.equal(swipe.actor_id, uid(1));
    await as(2);
    const match = (await call("select public.record_swipe($1,'like') as m", [uid(1)]))[0].m;
    assert.ok(match);
    const id = "30000000-0000-4000-8000-000000000001";
    const [sent] = await call("select * from public.send_message($1,$2,'Hello!')", [match, id]);
    assert.equal(sent.sender_id, uid(2));
    await as(1);
    assert.deepEqual((await call("select body from public.messages")).map((m) => m.body), ["Hello!"]);
    assert.equal((await call("select * from public.conversation_page()"))[0].id, match);
    await as(3);
    assert.equal((await call("select * from public.messages")).length, 0);
    assert.equal((await call("select * from public.matches")).length, 0);
    await assert.rejects(() => call("select public.send_message($1,$2,'Intruder')", [match, "30000000-0000-4000-8000-000000000002"]), /Unauthorized/);
    await assert.rejects(() => call("insert into public.messages(match_id,sender_id,body) values($1,$2,'Forged')", [match, uid(1)]), /permission denied/);
  } finally {
    await db.close();
  }
});

test("the migration deletes nothing and keeps existing members' edits", async () => {
  let before;
  const { db, call } = await database(async (d) => {
    await d.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'old@example.test',now(),$2),($3,'new@example.test',now(),'{}')", [uid(1), JSON.stringify({ picture: google, full_name: "Google name" }), uid(2)]);
    await d.query("insert into public.account_profiles(user_id,display_name,bio) values($1,'Edited name','Saved bio'),($2,'No bio','')", [uid(1), uid(2)]);
    const [{ id: s }] = (await d.query("insert into public.skills(name) values('Pre-existing') returning id")).rows;
    await d.query("insert into public.user_skills(user_id,skill_id,direction) values($1,$2,'teach'),($1,$2,'learn'),($3,$2,'teach')", [uid(1), s, uid(2)]);
    await d.query("update public.profiles set visible=true,onboarded=true");
    before = (await d.query("select (select count(*) from public.profiles)::int p,(select count(*) from public.account_profiles)::int a,(select count(*) from public.user_skills)::int s")).rows[0];
  });
  try {
    const [after] = await call("select (select count(*) from public.profiles)::int p,(select count(*) from public.account_profiles)::int a,(select count(*) from public.user_skills where skill_id in(select id from public.skills where name='Pre-existing'))::int s");
    assert.deepEqual(after, before);
    const [first] = await call("select display_name,bio,visible,onboarded,provider_avatar_url from public.profiles where id=$1", [uid(1)]);
    assert.deepEqual(first, { display_name: "Edited name", bio: "Saved bio", visible: true, onboarded: true, provider_avatar_url: google });
    // Previously listed but incomplete: kept, and hidden until finished.
    const [second] = await call("select display_name,onboarded from public.profiles where id=$1", [uid(2)]);
    assert.deepEqual(second, { display_name: "No bio", onboarded: false });
    assert.equal((await call("select email from public.account_profiles where user_id=$1", [uid(1)]))[0].email, "old@example.test");
  } finally {
    await db.close();
  }
});

function avatarApi(options = {}) {
  const log = { uploads: [], removed: [], rpc: [] };
  const storage = {
    upload: async (path, bytes, opts) => {
      log.uploads.push({ path, bytes, opts });
      return { error: options.uploadFails ? { message: "secret storage detail" } : null };
    },
    remove: async (paths) => {
      log.removed.push(...paths);
      return { error: null };
    },
    getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.example/${path}` } }),
  };
  const supabase = {
    storage: { from: (bucket) => (assert.equal(bucket, "avatars"), storage) },
    rpc: async (name, args) => {
      log.rpc.push({ name, args });
      if (name === "account_session_allowed") return { data: true, error: null };
      if (options.saveFails) return { data: null, error: { message: "secret db detail" } };
      return { data: options.previous ?? null, error: null };
    },
  };
  const session = { "@/lib/auth/session": {
    verifiedSession: async () => (options.anonymous ? null : { user: { id: "verified-owner" }, supabase }),
    mfaRequired: async () => false,
  }, "@/lib/auth/origin": { appOrigin: async () => "https://app.example" } };
  const module = loadTs("shared/server/avatar.ts", session, { File, FormData, crypto, Uint8Array });
  return { module, log };
}
// Values built inside the loaded module have another realm's prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value));
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
const webp = [...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBPVP8 ")];
const upload = (bytes, name = "me.png", type = "image/png", origin = "https://app.example") => {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type }));
  return new Request("https://app.example/api/avatar", { method: "POST", headers: { origin }, body: form });
};

test("picture type comes from file content, not the name or declared type", async () => {
  const { module, log } = avatarApi();
  const type = (b) => module.detectImage(new Uint8Array(b))?.type;
  assert.equal(type(png), "image/png");
  assert.equal(type(jpeg), "image/jpeg");
  assert.equal(type(webp), "image/webp");
  for (const bad of [
    Buffer.from("<script>alert(1)</script>"),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from("GIF89a...."),
    [...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WAVE")],
    [],
  ])
    assert.equal(type(bad), undefined);
  const forged = await module.POST(upload(Buffer.from("<html><script>x</script>"), "photo.png"));
  assert.equal(forged.status, 415);
  assert.equal(log.uploads.length, 0);
});

test("picture upload: session owns the path, size is capped, and the old file is replaced", async () => {
  const { module, log } = avatarApi({ previous: "verified-owner/old.png" });
  const res = await module.POST(upload(png));
  assert.equal(res.status, 200);
  const [{ path, opts }] = log.uploads;
  assert.match(path, /^verified-owner\/[0-9a-f-]{36}\.png$/);
  assert.equal(opts.contentType, "image/png");
  assert.equal(opts.upsert, false);
  assert.deepEqual(plain(log.rpc.at(-1)), { name: "set_my_avatar", args: { p_path: path } });
  assert.deepEqual(plain(log.removed), ["verified-owner/old.png"]);
  assert.equal((await res.json()).avatar_url, `https://cdn.example/${path}`);

  const big = avatarApi();
  const tooBig = new Array(5 * 1024 * 1024 + 1).fill(0);
  tooBig.splice(0, png.length, ...png);
  assert.equal((await big.module.POST(upload(tooBig))).status, 413);
  assert.equal(big.log.uploads.length, 0);
});

test("picture upload rejects other origins and signed-out users, hides details, and cleans up", async () => {
  assert.equal((await avatarApi().module.POST(upload(png, "a.png", "image/png", "https://evil.example"))).status, 403);
  assert.equal((await avatarApi({ anonymous: true }).module.POST(upload(png))).status, 401);
  const failed = await avatarApi({ uploadFails: true }).module.POST(upload(png));
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes("secret"), false);
  const unsaved = avatarApi({ saveFails: true });
  assert.equal((await unsaved.module.POST(upload(png))).status, 503);
  assert.deepEqual(plain(unsaved.log.removed), [unsaved.log.uploads[0].path]);
  const removal = avatarApi({ previous: "verified-owner/old.png" });
  const res = await removal.module.DELETE(new Request("https://app.example/api/avatar", { method: "DELETE", headers: { origin: "https://app.example" } }));
  assert.equal((await res.json()).avatar_url, null);
  assert.deepEqual(plain(removal.log.rpc.at(-1)), { name: "set_my_avatar", args: { p_path: null } });
  assert.deepEqual(plain(removal.log.removed), ["verified-owner/old.png"]);
});

test("every sign-in lands on the dashboard, which sends incomplete members to finish their profile", async () => {
  const load = async (result) => {
    const redirects = [];
    const page = loadTs("frontend/src/app/(app)/dashboard/page.tsx", {
      "next/navigation": { redirect: (to) => { redirects.push(to); throw new Error("redirected"); } },
      "@/lib/auth/require-user": { requireUser: async () => ({ id: "verified-owner" }) },
      "@/lib/supabase/server": { createClient: async () => ({ from: () => ({ select: () => ({ eq: (column, id) => {
        assert.equal(column, "id");
        assert.equal(id, "verified-owner");
        return { maybeSingle: async () => result };
      } }) }) }) },
      "@/components/demo/dashboard": { DashboardSummary: () => null },
    }).default;
    const rendered = await page().then(() => true, () => false);
    return { rendered, redirects };
  };
  assert.deepEqual(plain(await load({ data: { onboarded: false }, error: null })), { rendered: false, redirects: ["/profile"] });
  assert.deepEqual(plain(await load({ data: null, error: null })), { rendered: false, redirects: ["/profile"] });
  assert.deepEqual(plain(await load({ data: { onboarded: true }, error: null })), { rendered: true, redirects: [] });
  // A database outage must show the page's own error, not a redirect loop.
  assert.deepEqual(plain(await load({ data: null, error: { message: "down" } })), { rendered: true, redirects: [] });
});
