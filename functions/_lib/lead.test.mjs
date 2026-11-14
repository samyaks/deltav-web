import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INSERT_LEAD, saveLead } from "./lead.js";

function memoryDb() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      assert.equal(sql, INSERT_LEAD);
      return {
        bind(...values) {
          return {
            async run() {
              rows.push(values);
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function post(body, { json = true, accept = "application/json" } = {}) {
  const payload = json ? JSON.stringify(body) : new URLSearchParams(body).toString();
  return new Request("https://deltav.info/api/interest", {
    method: "POST",
    headers: {
      accept,
      "content-type": json ? "application/json" : "application/x-www-form-urlencoded",
    },
    body: payload,
  });
}

const lead = {
  name: "Avery Chen",
  email: "Avery@Example.com",
  business: "Northwind LLP",
  source: "law-firms",
};

test("saves the name, email, and business name", async () => {
  const db = memoryDb();
  const response = await saveLead(post(lead), db);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(db.rows.length, 1);
  const [name, email, business, source, createdAt] = db.rows[0];
  assert.equal(name, "Avery Chen");
  assert.equal(email, "avery@example.com");
  assert.equal(business, "Northwind LLP");
  assert.equal(source, "law-firms");
  assert.match(createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("accepts the form encoding the page sends without JavaScript", async () => {
  const db = memoryDb();
  const response = await saveLead(post({ ...lead, source: "software" }, { json: false, accept: "text/html" }), db);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Thanks/);
  assert.equal(db.rows[0][3], "software");
});

test("rejects a missing name, a bad email, and an unknown page", async () => {
  const db = memoryDb();
  const missing = await saveLead(post({ ...lead, name: "  " }), db);
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, "Add your name.");

  const email = await saveLead(post({ ...lead, email: "not-an-email" }), db);
  assert.equal(email.status, 400);

  const source = await saveLead(post({ ...lead, source: "other" }), db);
  assert.equal(source.status, 400);
  assert.equal(db.rows.length, 0);
});

test("drops a submission that filled the hidden field", async () => {
  const db = memoryDb();
  const response = await saveLead(post({ ...lead, website: "https://spam.example" }), db);
  assert.equal(response.status, 200);
  assert.equal(db.rows.length, 0);
});

test("does not save when the database is missing", async () => {
  const response = await saveLead(post(lead), undefined);
  assert.equal(response.status, 503);
});

test("both landing pages ask for name, email, and business name", async () => {
  for (const file of ["public/index.html", "public/law-firms/index.html"]) {
    const html = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(html, /action="\/api\/interest"/);
    assert.match(html, /name="name"/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="business"/);
    assert.match(html, /interest\.js/);
  }
});
