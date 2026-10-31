const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

// This suite deliberately accepts only a local Supabase stack, never a hosted project.
// Provision three fresh, confirmed local test accounts before opting in. It retains
// their records for inspection and performs no reset, delete, or administrative action.
const url = process.env.SKILLSWAP_TEST_URL;
test(
  "local Supabase: separate sessions, concurrent matching, message isolation and booking races",
  {
    skip: !url,
    timeout: 120000,
  },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
      "Live tests require a loopback Supabase URL. Hosted projects are refused.",
    );
    assert.equal(
      process.env.SKILLSWAP_TEST_ALLOW_MUTATIONS,
      "1",
      "Set SKILLSWAP_TEST_ALLOW_MUTATIONS=1 for disposable local accounts.",
    );
    const key = process.env.SKILLSWAP_TEST_PUBLISHABLE_KEY;
    assert.ok(key, "Set the local Supabase public key.");
    const clients = [];
    async function login(label) {
      const email = process.env[`SKILLSWAP_TEST_EMAIL_${label}`];
      const password = process.env[`SKILLSWAP_TEST_PASSWORD_${label}`];
      assert.ok(
        email && password,
        `Set the local test credentials for account ${label}.`,
      );
      const db = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      clients.push(db);
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password,
      });
      assert.equal(
        error,
        null,
        `Local account ${label} must be confirmed, password-authenticated, and not require MFA.`,
      );
      return { db, id: data.user.id };
    }
    async function ok(request) {
      const result = await request;
      assert.equal(result.error, null, result.error?.message);
      return result.data;
    }
    try {
      const [a, b, c] = await Promise.all(["A", "B", "C"].map(login));
      assert.equal(
        new Set([a.id, b.id, c.id]).size,
        3,
        "Use three different test accounts.",
      );
      const skill = (
        await ok(a.db.from("skills").select("id").limit(1).single())
      ).id;
      for (const [index, member] of [a, b, c].entries()) {
        await ok(member.db.rpc("ensure_my_account_profile"));
        await ok(
          member.db.rpc("save_member", {
            p_name: `Local test ${index}`,
            p_city: "Local test city",
            p_bio: "Isolated integration test",
            p_visible: true,
            p_skills: [
              { skill_id: skill, direction: "teach", level: "intermediate" },
            ],
          }),
        );
      }
      const device = await login("A");
      assert.equal(
        (
          await ok(
            device.db
              .from("profiles")
              .select("display_name")
              .eq("id", a.id)
              .single(),
          )
        ).display_name,
        "Local test 0",
      );
      assert.equal(
        (
          await ok(
            device.db
              .from("user_skills")
              .select("skill_id")
              .eq("user_id", a.id),
          )
        )[0].skill_id,
        skill,
      );
      assert.equal(
        (
          await ok(
            c.db
              .from("account_profiles")
              .update({ bio: "forged" })
              .eq("user_id", a.id)
              .select("user_id"),
          )
        ).length,
        0,
      );
      assert.equal(
        (
          await ok(
            a.db
              .from("matches")
              .select("id")
              .or(
                `and(user_a.eq.${a.id},user_b.eq.${b.id}),and(user_a.eq.${b.id},user_b.eq.${a.id})`,
              ),
          )
        ).length,
        0,
        "Use fresh test accounts with no prior match between A and B.",
      );
      const discovery = await ok(a.db.rpc("discover_members"));
      assert.ok(!discovery.some((row) => row.id === a.id));
      assert.ok(
        discovery.every(
          (row) =>
            !("email" in row) &&
            !("raw_user_meta_data" in row) &&
            !("user_metadata" in row),
        ),
      );
      await ok(
        b.db.rpc("record_swipe", { p_target: a.id, p_decision: "pass" }),
      );
      assert.equal(
        await ok(
          a.db.rpc("record_swipe", { p_target: b.id, p_decision: "like" }),
        ),
        null,
      );
      assert.equal((await ok(a.db.from("matches").select("id"))).length, 0);
      await ok(
        a.db.rpc("record_swipe", { p_target: b.id, p_decision: "pass" }),
      );
      await Promise.all([
        ok(a.db.rpc("record_swipe", { p_target: b.id, p_decision: "like" })),
        ok(b.db.rpc("record_swipe", { p_target: a.id, p_decision: "like" })),
      ]);
      const matches = await ok(a.db.from("matches").select("id"));
      assert.equal(matches.length, 1);
      const match = matches[0].id;
      await Promise.all([
        ok(a.db.rpc("record_swipe", { p_target: b.id, p_decision: "like" })),
        ok(b.db.rpc("record_swipe", { p_target: a.id, p_decision: "like" })),
      ]);
      assert.equal((await ok(a.db.from("matches").select("id"))).length, 1);
      const message = randomUUID();
      await Promise.all(
        [a, device].map((member) =>
          ok(
            member.db.rpc("send_message", {
              p_match: match,
              p_id: message,
              p_body: "Retry-safe local message",
            }),
          ),
        ),
      );
      assert.equal(
        (await ok(b.db.from("messages").select("id").eq("match_id", match)))
          .length,
        1,
      );
      assert.equal(
        (await ok(c.db.from("messages").select("id").eq("match_id", match)))
          .length,
        0,
      );
      assert.ok(
        (
          await c.db.rpc("send_message", {
            p_match: match,
            p_id: randomUUID(),
            p_body: "forbidden",
          })
        ).error,
      );
      const bookingIds = [randomUUID(), randomUUID()];
      for (const id of bookingIds)
        await ok(
          a.db.rpc("propose_session", {
            p_id: id,
            p_match: match,
            p_topic: "Local booking race",
            p_start: new Date(Date.now() + 86400000).toISOString(),
            p_duration: 60,
            p_notes: "",
            p_url: "",
          }),
        );
      assert.ok(
        (
          await a.db.rpc("transition_session", {
            p_id: bookingIds[0],
            p_status: "accepted",
          })
        ).error,
      );
      assert.ok(
        (
          await c.db.rpc("transition_session", {
            p_id: bookingIds[0],
            p_status: "accepted",
          })
        ).error,
      );
      const race = await Promise.all(
        bookingIds.map((id) =>
          b.db.rpc("transition_session", { p_id: id, p_status: "accepted" }),
        ),
      );
      assert.equal(
        race.filter((result) => !result.error).length,
        1,
        "Exactly one overlapping proposal can be accepted.",
      );
      assert.equal(race.filter((result) => result.error).length, 1);
      assert.equal(
        (await ok(c.db.from("sessions").select("id").in("id", bookingIds)))
          .length,
        0,
      );
      const anonymous = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      assert.ok(
        (
          await anonymous.rpc("record_swipe", {
            p_target: a.id,
            p_decision: "like",
          })
        ).error,
      );
    } finally {
      await Promise.allSettled(
        clients.map((db) => db.auth.signOut({ scope: "local" })),
      );
    }
  },
);
