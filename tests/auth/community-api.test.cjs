const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./load-ts.cjs");
function api(options = {}) {
  const calls = [];
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => {
          throw new Error("Unexpected database access");
        },
      }),
    }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "account_session_allowed")
        return { data: options.allowed !== false, error: null };
      if (options.failure)
        return { data: null, error: { message: "private database detail" } };
      if (name === "send_message")
        return {
          data: [{ id: args.p_id, match_id: args.p_match, body: args.p_body }],
          error: null,
        };
      if (name === "discover_members") return { data: [], error: null };
      return { data: null, error: null };
    },
  };
  const module = loadTs("shared/server/community.ts", {
    "@/lib/auth/session": {
      verifiedSession: async () =>
        options.anonymous ? null : { user: { id: "verified-owner" }, supabase },
      mfaRequired: async () => !!options.mfa,
    },
    "@/lib/auth/origin": { appOrigin: async () => "https://app.example" },
  });
  return { module, calls };
}
const id = "00000000-0000-4000-8000-000000000001";
const post = (body, origin = "https://app.example") =>
  new Request("https://app.example/api/community", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("community HTTP rejects anonymous, MFA, revoked sessions, cross-origin and malformed input", async () => {
  for (const options of [
    { anonymous: true },
    { mfa: true },
    { allowed: false },
  ]) {
    const { module } = api(options);
    assert.equal(
      (await module.GET(new Request("https://app.example/api/community")))
        .status,
      401,
    );
    assert.equal(
      (await module.POST(post({ op: "read", match: id }))).status,
      401,
    );
  }
  const { module, calls } = api();
  assert.equal(
    (await module.POST(post({ op: "read", match: id }, "https://evil.example")))
      .status,
    403,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    (await module.POST(post({ op: "send", id, match: id, body: "  " }))).status,
    400,
  );
  assert.equal(
    (
      await module.POST(
        post({
          op: "propose",
          id,
          match: id,
          topic: "Topic",
          start: "not a date",
          duration: 0,
          notes: "",
          url: "javascript:alert(1)",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await module.GET(
        new Request(
          "https://app.example/api/community?op=messages&match=invalid",
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    calls.some(
      (c) => c.name === "send_message" || c.name === "propose_session",
    ),
    false,
  );
});
test("mutations derive ownership in SQL and never forward supplied actor/sender IDs", async () => {
  const { module, calls } = api();
  const response = await module.POST(
    post({
      op: "send",
      match: id,
      id,
      body: " hello ",
      sender_id: "victim",
      actor_id: "victim",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.id, id);
  const sent = calls.find((c) => c.name === "send_message");
  assert.deepEqual(JSON.parse(JSON.stringify(sent.args)), {
    p_match: id,
    p_id: id,
    p_body: "hello",
  });
});
test("empty discovery is empty and database failures return an honest error without internal details", async () => {
  const { module } = api();
  const response = await module.GET(
    new Request("https://app.example/api/community?op=discover"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const failure = await api({ failure: true }).module.GET(
    new Request("https://app.example/api/community?op=discover"),
  );
  assert.equal(failure.status, 503);
  const body = await failure.json();
  assert.ok(body.error);
  assert.equal(JSON.stringify(body).includes("private database detail"), false);
});
