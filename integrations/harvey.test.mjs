import assert from "node:assert/strict";
import test from "node:test";
import { mapHarveyMatters, mapHarveyUsage } from "./harvey.mjs";

const usageV2 = {
  events: [
    {
      access_point: "WEB",
      action: "CREATE",
      cm_id: "1234.56",
      product_surface_area: "ASSISTANT",
      subsurface: "ASSISTANT_THREAD",
      utc_time: "2026-02-22 14:01:23",
      unique_usage_id: "019c85a7-a7c9-784f-bc59-0ddd5654274d",
      user: "user@example.com",
      vault_project_name: "Acme merger vault",
      workflow_name: "Lease review",
    },
  ],
};

test("maps Harvey v2 usage to person, time, and matter number", () => {
  const [row] = mapHarveyUsage(usageV2);
  assert.deepEqual(row, {
    tool: "Harvey",
    id: "019c85a7-a7c9-784f-bc59-0ddd5654274d",
    user: "user@example.com",
    at: "2026-02-22 14:01:23",
    matterNumber: "1234.56",
    product: "ASSISTANT",
    action: "CREATE",
  });
  assert.equal(JSON.stringify(row).includes("Acme"), false);
  assert.equal(JSON.stringify(row).includes("Lease review"), false);
});

test("maps Harvey v1 usage history", () => {
  const [row] = mapHarveyUsage([
    {
      event_id: 103230489,
      Time: "2024-09-03T14:47:12.000Z",
      User: "user@example.com",
      Task: "Assist",
      "Client Matter #": "1234.56",
      "Number of documents": 5,
    },
  ]);
  assert.equal(row.user, "user@example.com");
  assert.equal(row.matterNumber, "1234.56");
  assert.equal(row.product, "Assist");
  assert.equal(JSON.stringify(row).includes("documents"), false);
});

test("refuses Harvey query history", () => {
  assert.throws(
    () => mapHarveyUsage({ events: [{ user: "a@b.c", query: "Summarize the indemnity clause.", response: "Three provisions." }] }),
    /not kept/,
  );
});

test("maps Harvey client matters without the description", () => {
  const [row] = mapHarveyMatters({
    client_matters: [
      {
        id: "018d856f-0664-772c-9ed9-b2316fd881d3",
        name: "1234-5678",
        description: "Client B - Project Test",
        user_count: 8,
        total_events: 37,
        matter_number: "M001",
        deleted_at: null,
      },
      {
        id: "deleted",
        matter_number: "M002",
        user_count: 1,
        total_events: 2,
        deleted_at: "2024-02-22T16:45:10.209Z",
      },
    ],
  });
  assert.deepEqual(row, {
    tool: "Harvey",
    id: "018d856f-0664-772c-9ed9-b2316fd881d3",
    matterNumber: "M001",
    users: 8,
    queries: 37,
  });
  assert.equal(JSON.stringify(row).includes("Client B"), false);
});
