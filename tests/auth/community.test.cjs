const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("community database: three-account RLS, atomic saves, matching, retries, messaging, scheduling and revoked-session denial", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));create table auth.mfa_factors(user_id uuid,status text);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,owner_id text);create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
    for (const file of fs.readdirSync("backend/supabase/migrations").sort()) {
      if (file === "202610290001_community.sql") {
        for (let n = 101; n <= 103; n++)
          await db.query(
            "insert into auth.users(id,email_confirmed_at) values($1,now())",
            [uid(n)],
          );
        await db.query(
          "insert into public.profiles(id,display_name,bio) values($1,'Directory name','Directory bio'),($2,'Existing member','Keep this bio')",
          [uid(101), uid(102)],
        );
        await db.query(
          "insert into public.account_profiles(user_id,display_name,city,bio) values($1,'Edited privately','Saved city','Saved bio'),($2,'Account only','Other city','Other bio')",
          [uid(101), uid(103)],
        );
      }
      await db.exec(
        fs.readFileSync("backend/supabase/migrations/" + file, "utf8"),
      );
    }
    const backfill = (
      await db.query(
        "select id,display_name,city,bio,visible,onboarded from public.profiles where id=$1",
        [uid(101)],
      )
    ).rows[0];
    assert.equal(backfill.display_name, "Edited privately");
    assert.equal(backfill.bio, "Saved bio");
    assert.equal(backfill.city, "Saved city");
    assert.equal(backfill.visible, false);
    assert.equal(backfill.onboarded, false);
    assert.equal(
      (
        await db.query(
          "select display_name from public.account_profiles where user_id=$1",
          [uid(102)],
        )
      ).rows[0].display_name,
      "Existing member",
    );
    assert.equal(
      (
        await db.query("select display_name from public.profiles where id=$1", [
          uid(103),
        ])
      ).rows[0].display_name,
      "Account only",
    );
    await db.exec(
      fs.readFileSync("backend/supabase/catalog/skills.sql", "utf8"),
    );
    await db.exec(
      fs.readFileSync("backend/supabase/catalog/skills.sql", "utf8"),
    );
    for (let n = 1; n <= 3; n++) {
      await db.query(
        `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)`,
        [
          uid(n),
          `private${n}@example.test`,
          JSON.stringify({ full_name: "Member " + n }),
        ],
      );
      await db.query("insert into auth.sessions values($1,$2)", [
        sid(n),
        uid(n),
      ]);
    }
    async function as(n, aal = "aal1") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: uid(n), session_id: sid(n), aal }),
      ]);
      await db.exec("set role authenticated");
    }
    const call = async (sql, args = []) => (await db.query(sql, args)).rows;
    let skill;
    await db.exec("reset role");
    skill = (await call("select id from public.skills where name='Cooking'"))[0]
      .id;
    for (let n = 1; n <= 3; n++) {
      await as(n);
      assert.equal(
        (await call("select * from public.ensure_my_account_profile()"))[0]
          .display_name,
        "Member " + n,
      );
      await call("select public.save_member($1,$2,$3,true,$4)", [
        "Edited " + n,
        "City",
        "Safe bio",
        JSON.stringify([
          { skill_id: skill, direction: "learn", level: "beginner" },
          { skill_id: skill, direction: "teach", level: "beginner" },
        ]),
      ]);
    }
    // Profile visibility and individual skill changes use the same ownership rules.
    await as(3);
    await call("select public.save_member('C','City','Safe bio',false,$1)", [
      JSON.stringify([
        { skill_id: skill, direction: "teach", level: "beginner" },
      ]),
    ]);
    await as(1);
    assert.equal(
      (await call("select * from public.profiles where id=$1", [uid(3)]))
        .length,
      0,
    );
    assert.equal(
      (
        await call("select * from public.user_skills where user_id=$1", [
          uid(3),
        ])
      ).length,
      0,
    );
    await as(3);
    await call(
      "select public.save_member('Edited 3','City','Safe bio',true,$1)",
      [
        JSON.stringify([
          { skill_id: skill, direction: "teach", level: "beginner" },
        ]),
      ],
    );
    await call("select public.set_my_skill($1,'learn','advanced',false)", [
      skill,
    ]);
    await call("select public.set_my_skill($1,'learn','advanced',false)", [
      skill,
    ]);
    assert.equal(
      (
        await call(
          "select * from public.user_skills where user_id=$1 and direction='learn'",
          [uid(3)],
        )
      ).length,
      1,
    );
    await call("select public.set_my_skill($1,'learn','advanced',true)", [
      skill,
    ]);
    assert.equal(
      (
        await call(
          "select * from public.user_skills where user_id=$1 and direction='learn'",
          [uid(3)],
        )
      ).length,
      0,
    );
    await call("select public.set_my_skill($1,'learn','advanced',false)", [
      skill,
    ]);
    await as(1);
    assert.equal(
      (await call("select * from public.ensure_my_account_profile()"))[0]
        .display_name,
      "Edited 1",
    );
    assert.equal(
      (await call("select * from public.account_profiles")).length,
      1,
    );
    assert.equal(
      (await call("select * from public.profiles where id=$1", [uid(2)]))[0]
        .bio,
      "Safe bio",
    );
    assert.equal(
      (await call("select * from public.profiles")).some(
        (p) => "email" in p || "raw_user_meta_data" in p,
      ),
      false,
    );
    assert.equal(
      (
        await call(
          "update public.account_profiles set bio=$1 where user_id=$2 returning *",
          ["hacked", uid(2)],
        )
      ).length,
      0,
    );
    await assert.rejects(() =>
      call("update public.profiles set display_name=$1 where id=$2", [
        "conflict",
        uid(1),
      ]),
    );
    await assert.rejects(() =>
      call("update public.account_profiles set user_id=$1", [uid(2)]),
    );
    await assert.rejects(() =>
      call("select public.save_member($1,$2,$3,true,$4)", [
        "Rollback",
        "",
        "bad",
        JSON.stringify([
          { skill_id: uid(999), direction: "teach", level: "beginner" },
        ]),
      ]),
    );
    assert.equal(
      (
        await call("select display_name from public.profiles where id=$1", [
          uid(1),
        ])
      )[0].display_name,
      "Edited 1",
    );
    const duplicate = JSON.stringify([
      { skill_id: skill, direction: "learn", level: "beginner" },
      { skill_id: skill, direction: "learn", level: "beginner" },
    ]);
    await assert.rejects(() =>
      call("select public.save_member($1,$2,$3,true,$4)", [
        "Rollback",
        "",
        "",
        duplicate,
      ]),
    );
    assert.equal(
      (
        await call("select * from public.user_skills where user_id=$1", [
          uid(1),
        ])
      ).length,
      2,
    );
    assert.equal(
      (
        await call(
          "select * from public.discover_members(null,'','',$1,null,null)",
          [skill],
        )
      ).length,
      2,
    );
    await assert.rejects(() =>
      call("select public.record_swipe($1,'like')", [uid(1)]),
    );
    assert.equal(
      (await call("select public.record_swipe($1,'like') as id", [uid(2)]))[0]
        .id,
      null,
    );
    assert.equal((await call("select * from public.matches")).length, 0);
    assert.equal(
      (await call("select * from public.discover_members()")).length,
      1,
    );
    await as(2);
    const match = (
      await call("select public.record_swipe($1,'like') as id", [uid(1)])
    )[0].id;
    assert.ok(match);
    for (let n = 0; n < 4; n++) {
      await as((n % 2) + 1);
      assert.equal(
        (
          await call("select public.record_swipe($1,'like') as id", [
            uid(n % 2 === 0 ? 2 : 1),
          ])
        )[0].id,
        match,
      );
    }
    assert.equal((await call("select * from public.matches")).length, 1);
    await assert.rejects(() =>
      call("insert into public.matches(user_a,user_b) values($1,$2)", [
        uid(2),
        uid(3),
      ]),
    );
    await as(1);
    await call("select public.record_swipe($1,'pass')", [uid(2)]);
    assert.equal((await call("select * from public.matches")).length, 1);
    const message = uid(20);
    await call("select public.send_message($1,$2,$3)", [
      match,
      message,
      "<script>plain text</script>",
    ]);
    await call("select public.send_message($1,$2,$3)", [
      match,
      message,
      "<script>plain text</script>",
    ]);
    assert.equal((await call("select * from public.messages")).length, 1);
    await assert.rejects(() =>
      call("select public.send_message($1,$2,'   ')", [match, uid(21)]),
    );
    await assert.rejects(() =>
      call(
        "insert into public.messages(match_id,sender_id,body) values($1,$2,'forged')",
        [match, uid(2)],
      ),
    );
    await as(2);
    assert.equal(
      (await call("select * from public.messages"))[0].body,
      "<script>plain text</script>",
    );
    assert.equal(
      Number(
        (await call("select * from public.conversation_page()"))[0].unread,
      ),
      1,
    );
    await call("select public.mark_read($1,$2)", [match, message]);
    assert.equal(
      Number(
        (await call("select * from public.conversation_page()"))[0].unread,
      ),
      0,
    );
    // A stale read acknowledgement must not mark a later message read.
    await as(1);
    await call("select public.send_message($1,$2,'Later arrival')", [
      match,
      uid(23),
    ]);
    await as(2);
    await call("select public.mark_read($1,$2)", [match, message]);
    assert.equal(
      Number(
        (await call("select * from public.conversation_page()"))[0].unread,
      ),
      1,
    );
    await as(3);
    assert.equal((await call("select * from public.messages")).length, 0);
    await assert.rejects(() =>
      call("select public.send_message($1,$2,'intrusion')", [match, uid(22)]),
    );
    await assert.rejects(() =>
      call("select public.mark_read($1,$2)", [match, message]),
    );
    const booking = uid(30),
      start = new Date(Date.now() + 86400000).toISOString();
    await as(1);
    await call(
      "select public.propose_session($1,$2,$3,$4,60,'notes','https://meet.example.test/room')",
      [booking, match, "Cooking", start],
    );
    await assert.rejects(() =>
      call("select public.transition_session($1,'accepted')", [booking]),
    );
    await assert.rejects(() =>
      call("select public.propose_session($1,$2,'x',$3,0,'','')", [
        uid(31),
        match,
        start,
      ]),
    );
    await as(3);
    assert.equal((await call("select * from public.sessions")).length, 0);
    await assert.rejects(() =>
      call("select public.transition_session($1,'accepted')", [booking]),
    );
    await as(2);
    await call("select public.transition_session($1,'accepted')", [booking]);
    await call("select public.transition_session($1,'accepted')", [booking]);
    await assert.rejects(() =>
      call("select public.transition_session($1,'completed')", [booking]),
    );
    // A second match sharing member 2 may propose but cannot accept an overlap.
    await call("select public.record_swipe($1,'like')", [uid(3)]);
    await as(3);
    const second = (
      await call("select public.record_swipe($1,'like') id", [uid(2)])
    )[0].id;
    await call("select public.propose_session($1,$2,'Music',$3,30,'','')", [
      uid(32),
      second,
      start,
    ]);
    await as(2);
    await assert.rejects(() =>
      call("select public.transition_session($1,'accepted')", [uid(32)]),
    );
    await call("select public.transition_session($1,'cancelled')", [booking]);
    await assert.rejects(() =>
      call("select public.transition_session($1,'accepted')", [booking]),
    );
    await call("select public.transition_session($1,'accepted')", [uid(32)]);
    await db.exec("reset role");
    await db.query(
      "update public.sessions set starts_at=now()-interval '2 hours' where id=$1",
      [uid(32)],
    );
    await as(3);
    await call("select public.transition_session($1,'completed')", [uid(32)]);
    assert.equal(
      (await call("select * from public.session_page(false,0)")).length,
      0,
    );
    assert.equal(
      (await call("select * from public.session_page(true,0)"))[0].id,
      uid(32),
    );
    await db.exec("reset role");
    await db.query("delete from auth.sessions where id=$1", [sid(1)]);
    await as(1);
    assert.equal((await call("select * from public.matches")).length, 0);
    await assert.rejects(() =>
      call("select public.record_swipe($1,'like')", [uid(3)]),
    );
    await db.exec("reset role");
    await db.query("insert into auth.mfa_factors values($1,'verified')", [
      uid(2),
    ]);
    await as(2);
    assert.equal((await call("select * from public.messages")).length, 0);
    await as(2, "aal2");
    assert.equal((await call("select * from public.messages")).length, 2);
    await db.exec("reset role;set role anon");
    await assert.rejects(() => call("select * from public.messages"));
    await assert.rejects(() =>
      call("select public.send_message($1,$2,'x')", [match, uid(50)]),
    );
  } finally {
    await db.close();
  }
});
