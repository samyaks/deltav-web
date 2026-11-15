import assert from "node:assert/strict";
import test from "node:test";
import { mapLegoraAudit, mapLegoraCredits } from "./legora.mjs";

test("maps Legora credits by member, feature, and project", () => {
  const [row] = mapLegoraCredits([
    { member: "ada@firm.example", feature: "Agent", project: "20418-0032", credits: 12, at: "2026-11-01" },
  ]);
  assert.deepEqual(row, {
    tool: "Legora",
    user: "ada@firm.example",
    feature: "Agent",
    project: "20418-0032",
    credits: 12,
    at: "2026-11-01",
  });
});

test("accepts a Legora matter on a credit row", () => {
  const [row] = mapLegoraCredits([{ user: "ada@firm.example", matter: "20418-0032", credits: 3 }]);
  assert.equal(row.project, "20418-0032");
  assert.equal(row.credits, 3);
});

test("refuses a Legora prompt or client name", () => {
  assert.throws(
    () => mapLegoraCredits([{ member: "ada@firm.example", prompt: "Review this lease." }]),
    /not kept/,
  );
  assert.throws(
    () => mapLegoraAudit([{ user: "ada@firm.example", action: "run", client: "Acme" }]),
    /not kept/,
  );
});

test("maps a Legora audit row to who, what, and when", () => {
  const [row] = mapLegoraAudit([
    { user: "ada@firm.example", action: "agent run", time: "2026-11-02T15:00:00Z" },
  ]);
  assert.deepEqual(row, {
    tool: "Legora",
    user: "ada@firm.example",
    action: "agent run",
    at: "2026-11-02T15:00:00Z",
  });
});
