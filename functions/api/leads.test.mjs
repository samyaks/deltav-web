import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { onRequest } from "./leads.js";

const SECRET = "test-secret";
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function installFetch(success) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

function talkBody(extra = {}) {
  return {
    email: "ada@company.com",
    name: "Ada Lovelace",
    company: "Analytical",
    role: "Engineering leadership",
    goal: "Whether our AI spend is paying off",
    turnstileToken: "token",
    source: "talk-to-us",
    ...extra,
  };
}

async function post(body, { fail, secret = SECRET } = {}) {
  const inserts = [];
  installFetch(true);
  const env = {
    TURNSTILE_SECRET: secret,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                if (fail) throw fail;
                inserts.push({ sql, args });
              },
            };
          },
        };
      },
    },
  };
  const request = new Request("https://deltav.info/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.8" },
    body: JSON.stringify(body),
  });
  const response = await onRequest({ request, env });
  return { status: response.status, data: await response.json(), inserts };
}

test("demo lead stores the gate payload and accepts a personal email", async () => {
  const { status, data, inserts } = await post({
    email: "SK@Gmail.com",
    source: "demo",
    goal: "demo_access",
    team_size: "unknown",
    outreach_code: "KyleA",
    referrer_path: "/KyleA",
    utm_source: "linkedin",
    utm_medium: "social",
    utm_campaign: "roi",
    utm_content: "ad-a",
    utm_term: "ai spend",
    turnstileToken: "token",
  });

  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(inserts.length, 1);
  const { sql, args } = inserts[0];
  assert.match(sql, /utm_content, utm_term/);
  assert.deepEqual(args, [
    "sk@gmail.com",
    "",
    "",
    "",
    "unknown",
    "demo_access",
    null,
    null,
    null,
    "KyleA",
    "demo",
    "/KyleA",
    "linkedin",
    "social",
    "roi",
    "ad-a",
    "ai spend",
  ]);
});

test("demo ad source is stored, and team size stays unknown", async () => {
  const { status, data, inserts } = await post({
    email: "a@b.co",
    source: "demo_ad",
    team_size: "1 to 25",
    goal: "Something else",
    turnstileToken: "token",
  });
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(inserts[0].args[4], "unknown");
  assert.equal(inserts[0].args[5], "demo_access");
  assert.equal(inserts[0].args[10], "demo_ad");
});

test("a repeated demo email is success", async () => {
  const { status, data, inserts } = await post(
    { email: "sk@gmail.com", source: "demo", turnstileToken: "token" },
    { fail: new Error("UNIQUE constraint failed: leads.email") }
  );
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(inserts.length, 0);
});

test("demo still requires a real email", async () => {
  const { status, data, inserts } = await post({
    email: "sk@company",
    source: "demo",
    turnstileToken: "token",
  });
  assert.equal(status, 400);
  assert.equal(data.errors.email, "Enter a valid email address.");
  assert.equal(inserts.length, 0);
});

test("talk form still requires name, company, and role", async () => {
  const { status, data, inserts } = await post({
    email: "ada@company.com",
    source: "talk-to-us",
    turnstileToken: "token",
  });
  assert.equal(status, 400);
  assert.equal(data.errors.name, "Required.");
  assert.equal(data.errors.company, "Required.");
  assert.equal(data.errors.role, "Choose an option.");
  assert.equal(inserts.length, 0);
});

test("talk insert does not use the new campaign columns", async () => {
  const { status, inserts } = await post(talkBody({ outreach_code: "not valid!" }));
  assert.equal(status, 200);
  assert.doesNotMatch(inserts[0].sql, /utm_content/);
  assert.equal(inserts[0].args[9], null);
  assert.equal(inserts[0].args[4], "");
});

test("a repeated talk email is still an error", async () => {
  const { status, data } = await post(talkBody(), {
    fail: new Error("UNIQUE constraint failed: leads.email"),
  });
  assert.equal(status, 500);
  assert.equal(data.ok, false);
});

test("honeypot looks successful and stores nothing", async () => {
  const { status, data, inserts } = await post({
    email: "bot@company.com",
    source: "demo",
    website: "https://spam.example",
    turnstileToken: "token",
  });
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(inserts.length, 0);
});

test("demo rejects a failed turnstile check", async () => {
  installFetch(false);
  const inserts = [];
  const env = {
    TURNSTILE_SECRET: SECRET,
    DB: {
      prepare() {
        return { bind() { return { async run() { inserts.push(1); } }; } };
      },
    },
  };
  const request = new Request("https://deltav.info/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "sk@gmail.com", source: "demo", turnstileToken: "nope" }),
  });
  const response = await onRequest({ request, env });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.errors.turnstile, "Verification failed. Try again.");
  assert.equal(inserts.length, 0);
});
