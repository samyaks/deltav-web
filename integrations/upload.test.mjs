import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseHarveyMattersCsv,
  parseHarveyUsageCsv,
  parseLegoraAuditCsv,
  parseLegoraCreditsCsv,
} from "./upload.mjs";

const example = (name) => readFileSync(new URL(`./examples/${name}`, import.meta.url), "utf8");

test("reads the four example uploads", () => {
  const [usage] = parseHarveyUsageCsv(example("harvey-usage.csv"));
  assert.equal(usage.user, "user@example.com");
  assert.equal(usage.at, "2026-02-22T14:01:23Z");
  assert.equal(usage.matterNumber, "1234.56");
  assert.equal(usage.product, "ASSISTANT");

  const [matter] = parseHarveyMattersCsv(example("harvey-matters.csv"));
  assert.equal(matter.matterNumber, "M001");
  assert.equal(matter.users, 8);
  assert.equal(matter.queries, 37);

  const [credits] = parseLegoraCreditsCsv(example("legora-credits.csv"));
  assert.equal(credits.user, "ada@firm.example");
  assert.equal(credits.project, "20418-0032");
  assert.equal(credits.credits, 12);

  const [audit] = parseLegoraAuditCsv(example("legora-audit.csv"));
  assert.equal(audit.action, "agent run");
  assert.equal(audit.at, "2026-11-02T15:00:00Z");
});

test("keeps a quoted matter number as text and a comma inside an action", () => {
  const [usage] = parseHarveyUsageCsv(
    'user,at,matter_number,product,action,id\nada@firm.example,2026-11-01T00:00:00Z,"1234.56",ASSISTANT,CREATE,\n',
  );
  assert.equal(usage.matterNumber, "1234.56");

  const [audit] = parseLegoraAuditCsv(
    'member,action,at\nada@firm.example,"agent run, review",2026-11-02T15:00:00Z\n',
  );
  assert.equal(audit.action, "agent run, review");
});

test("refuses a column that is not part of the upload", () => {
  assert.throws(
    () => parseHarveyUsageCsv(
      "user,at,matter_number,product,action,id,query\na@b.c,2026-11-01T00:00:00Z,1,ASSISTANT,CREATE,x,Summarize this\n",
    ),
    /header must be/,
  );
  assert.throws(
    () => parseLegoraCreditsCsv(
      "member,feature,project,credits,at,client\nada@firm.example,Agent,1,2,2026-11-01T00:00:00Z,Acme\n",
    ),
    /header must be/,
  );
});

test("refuses a credits value that is not a number", () => {
  assert.throws(
    () => parseLegoraCreditsCsv(
      "member,feature,project,credits,at\nada@firm.example,Agent,20418-0032,twelve,2026-11-01T00:00:00Z\n",
    ),
    /must be a number/,
  );
});
