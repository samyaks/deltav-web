import assert from "node:assert/strict";
import test from "node:test";
import { mapEverlawProjects, mapEverlawUsage } from "./everlaw.mjs";

test("maps Everlaw usage to person, matter, and document count", () => {
  const [row] = mapEverlawUsage([
    { user: "casey@firm.example", at: "2026-11-03T16:20:00Z", matter_number: "31177-0009", action: "review", docs: 48, id: "ev-1001" },
  ]);
  assert.deepEqual(row, {
    tool: "Everlaw",
    id: "ev-1001",
    user: "casey@firm.example",
    at: "2026-11-03T16:20:00Z",
    matterNumber: "31177-0009",
    action: "review",
    docs: 48,
  });
});

test("refuses an Everlaw description or client name", () => {
  assert.throws(
    () => mapEverlawUsage([{ user: "a@b.c", description: "Opened CONFIDENTIAL.docx" }]),
    /not kept/,
  );
  assert.throws(
    () => mapEverlawProjects([{ matter_number: "1", client: "Acme", docs: 1 }]),
    /not kept/,
  );
});

test("maps Everlaw project totals without content fields", () => {
  const [row] = mapEverlawProjects([
    { matter_number: "31177-0009", users: 3, docs: 240, id: "ev-proj-01" },
  ]);
  assert.deepEqual(row, {
    tool: "Everlaw",
    id: "ev-proj-01",
    matterNumber: "31177-0009",
    users: 3,
    docs: 240,
  });
});
