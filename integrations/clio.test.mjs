import assert from "node:assert/strict";
import test from "node:test";
import { mapClioMatters, mapClioTime } from "./clio.mjs";

test("maps Clio time to person, matter, hours, and rate", () => {
  const [row] = mapClioTime([
    { user: "ada@firm.example", at: "2026-11-01T00:00:00Z", matter_number: "20418-0032", hours: 8.6, rate: 450, id: "clio-t-001" },
  ]);
  assert.deepEqual(row, {
    tool: "Clio",
    id: "clio-t-001",
    user: "ada@firm.example",
    at: "2026-11-01T00:00:00Z",
    matterNumber: "20418-0032",
    hours: 8.6,
    rate: 450,
  });
});

test("refuses Clio notes, descriptions, and client-tainted labels", () => {
  assert.throws(
    () => mapClioTime([{ user: "a@b.c", matter_number: "1", hours: 1, note: "Called Acme" }]),
    /not kept/,
  );
  assert.throws(
    () => mapClioTime([{ user: "a@b.c", matter_number: "1", hours: 1, activity_description: "Phone Call" }]),
    /not kept/,
  );
  assert.throws(
    () => mapClioMatters([{ matter_number: "1", client: "Acme" }]),
    /not kept/,
  );
  assert.throws(
    () => mapClioMatters([{ matter_number: "1", display_name: "Acme — Lease" }]),
    /not kept/,
  );
});

test("maps Clio matters without client fields", () => {
  const [row] = mapClioMatters([
    { matter_number: "20418-0032", status: "Open", id: "clio-m-001" },
  ]);
  assert.deepEqual(row, {
    tool: "Clio",
    id: "clio-m-001",
    matterNumber: "20418-0032",
    status: "Open",
  });
});
