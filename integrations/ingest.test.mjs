import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ingestFeeds } from "./ingest.mjs";
import { parseUploadCsv } from "./upload.mjs";

const example = (name) => readFileSync(new URL(`./examples/${name}`, import.meta.url), "utf8");

test("rolls demo CSVs up to org, user, and matter views", () => {
  const feeds = [
    "demo/harvey-usage.csv",
    "demo/legora-credits.csv",
    "demo/legora-audit.csv",
    "demo/everlaw-usage.csv",
    "demo/clio-time.csv",
    "demo/clio-matters.csv",
  ].map((name) => parseUploadCsv(example(name)));

  const view = ingestFeeds(feeds, {
    seats: [
      { tool: "Harvey", licensed: 10, monthlyCost: 2500 },
      { tool: "Legora", licensed: 6, monthlyCost: 1800 },
      { tool: "Everlaw", licensed: 4, monthlyCost: 1200 },
    ],
  });

  assert.equal(view.org.activeUsers, 7);
  assert.equal(view.org.mattersWithAi, 5);
  assert.ok(view.org.spend > view.org.usageSpend);
  assert.ok(view.org.recoverable > 0);
  assert.equal(view.org.timeHours, 47.1);
  assert.ok(view.org.timeCost > 0);

  const lease = view.matters.find((row) => row.matterNumber === "20418-0032");
  assert.ok(lease);
  assert.deepEqual(lease.tools, ["Clio", "Harvey", "Legora"]);
  assert.ok(lease.spend > 0);
  assert.equal(lease.hours, 8.6);
  assert.equal(lease.status, "Open");

  const ada = view.users.find((row) => row.user === "ada@firm.example");
  assert.ok(ada.spend > 0);
  assert.equal(ada.hours, 8.6);
  assert.ok(ada.matters.includes("20418-0032"));

  const harvey = view.tools.find((row) => row.tool === "Harvey");
  assert.equal(harvey.units, 10);
  assert.equal(harvey.unitKind, "query");

  const clio = view.tools.find((row) => row.tool === "Clio");
  assert.equal(clio.unitKind, "hour");
  assert.equal(clio.hours, 47.1);
  assert.equal(clio.isAi, false);
});

test("detects each example feed and refuses unknown headers", () => {
  assert.equal(parseUploadCsv(example("harvey-usage.csv")).kind, "harvey-usage");
  assert.equal(parseUploadCsv(example("everlaw-usage.csv")).kind, "everlaw-usage");
  assert.equal(parseUploadCsv(example("clio-time.csv")).kind, "clio-time");
  assert.throws(
    () => parseUploadCsv("foo,bar\n1,2\n"),
    /does not match a known feed/,
  );
});
