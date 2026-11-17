import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isGmailOrYahoo, WORK_EMAIL_ERROR } from "./email-domain.js";
import { onRequest } from "./api/leads.js";

test("the form and the API share one Gmail and Yahoo rule", () => {
  const publicCopy = readFileSync(new URL("../public/email-domain.js", import.meta.url), "utf8");
  const functionCopy = readFileSync(new URL("./email-domain.js", import.meta.url), "utf8");
  assert.equal(publicCopy, functionCopy);
  assert.match(readFileSync(new URL("../public/talk.js", import.meta.url), "utf8"), /isGmailOrYahoo\(email\)/);
  assert.match(readFileSync(new URL("./api/leads.js", import.meta.url), "utf8"), /isGmailOrYahoo\(email\)/);
});

test("rejects Gmail and Yahoo domains, including country domains and subdomains", () => {
  const blocked = [
    "ada@gmail.com",
    "Ada@Gmail.COM",
    "ada+tag@gmail.com",
    "a.b@gmail.com",
    "ada@googlemail.com",
    "ada@mail.gmail.com",
    "ada@yahoo.com",
    "ada@yahoo.co.uk",
    "ada@yahoo.co.jp",
    "ada@yahoo.com.au",
    "ada@yahoo.com.br",
    "ada@yahoo.fr",
    "ada@yahoo.de",
    "ada@mail.yahoo.com",
    "ada@mail.yahoo.co.uk",
    "ada@ymail.com",
    "ada@rocketmail.com",
    "ada@yahoo.com.",
    "ada@gmai\u200bl.com",
    "ada@yahoo.co.uk\ufeff",
  ];
  for (const email of blocked) assert.equal(isGmailOrYahoo(email), true, email);
});

test("allows company domains, including ones that merely resemble Gmail or Yahoo", () => {
  const allowed = [
    "ada@acme.com",
    "ada@acme.co.uk",
    "ada@cs.ox.ac.uk",
    "ada@company.com.au",
    "ada@notgmail.com",
    "ada@yahooinc.com",
    "ada@gmail.company.com",
    "ada@gmail.com.example.com",
    "ada@outlook.com",
    "ada@proton.me",
    "",
    "not-an-email",
  ];
  assert.equal(isGmailOrYahoo("@gmail.com"), true);
  for (const email of allowed) assert.equal(isGmailOrYahoo(email), false, email);
});

function lead(email, extra = {}) {
  return {
    email,
    name: "Ada Lovelace",
    company: "Acme",
    role: "Engineering leadership",
    team_size: "26 to 100",
    ai_tools: ["Cursor"],
    monthly_spend: "Under $10k",
    question: "Where does the spend go?",
    website: "",
    source: "talk-to-us",
    turnstileToken: "token",
    ...extra,
  };
}

function post(body) {
  return onRequest({
    request: new Request("https://deltav.info/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env: { TURNSTILE_SECRET: "secret", DB: { prepare() { throw new Error("DB should not be called"); } } },
  });
}

test("the API refuses Gmail and Yahoo before Turnstile or storage", async () => {
  for (const email of ["ada@gmail.com", "ADA@YAHOO.CO.UK", "ada@ymail.com", "ada@googlemail.com"]) {
    const response = await post(lead(email));
    assert.equal(response.status, 400, email);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.errors.email, WORK_EMAIL_ERROR);
  }
});

test("the API still accepts a company email and stores it", async () => {
  const inserted = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    return { async json() { return { success: true }; } };
  };
  try {
    const response = await onRequest({
      request: new Request("https://deltav.info/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead("Ada@Acme.co.uk")),
      }),
      env: {
        TURNSTILE_SECRET: "secret",
        DB: {
          prepare(sql) {
            assert.match(sql, /INSERT INTO leads/);
            return {
              bind(...args) {
                inserted.push(args);
                return { async run() {} };
              },
            };
          },
        },
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0][0], "ada@acme.co.uk");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a missing or malformed email is still a format error", async () => {
  const missing = await post(lead(""));
  assert.equal((await missing.json()).errors.email, "Enter a valid email address.");
  const malformed = await post(lead("ada@"));
  assert.equal((await malformed.json()).errors.email, "Enter a valid email address.");
});
