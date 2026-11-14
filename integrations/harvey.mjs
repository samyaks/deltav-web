import { assertNoContent } from "./guard.mjs";

// Harvey usage history. v2 is GET /api/v2/history/usage. v1 is a flat array
// from GET /api/v1/history/usage. Query history is a different endpoint and
// includes the prompt and the answer, so it is refused.

function eventsOf(payload) {
  const events = Array.isArray(payload) ? payload : payload?.events;
  if (!Array.isArray(events)) {
    throw new Error("Harvey usage history has no events.");
  }
  return events;
}

function mapEvent(event) {
  assertNoContent(event, "Harvey");
  if ("utc_time" in event || "cm_id" in event || "unique_usage_id" in event) {
    return {
      tool: "Harvey",
      id: event.unique_usage_id ?? "",
      user: event.user ?? "",
      at: event.utc_time ?? "",
      matterNumber: event.cm_id ?? "",
      product: event.product_surface_area ?? "",
      action: event.action ?? "",
    };
  }
  return {
    tool: "Harvey",
    id: event.event_id == null ? "" : String(event.event_id),
    user: event.User ?? "",
    at: event.Time ?? "",
    matterNumber: event["Client Matter #"] ?? "",
    product: event.Task ?? "",
    action: "",
  };
}

export function mapHarveyUsage(payload) {
  return eventsOf(payload).map(mapEvent);
}

// GET /api/v1/client_matters. The description and the display name can carry
// a client name, so only the firm's matter number and the usage counts are kept.
export function mapHarveyMatters(payload) {
  const matters = payload?.client_matters;
  if (!Array.isArray(matters)) {
    throw new Error("Harvey client matters has no client_matters.");
  }
  return matters
    .filter((matter) => !matter.deleted_at)
    .map((matter) => {
      assertNoContent(
        { id: matter.id, matter_number: matter.matter_number },
        "Harvey",
      );
      return {
        tool: "Harvey",
        id: matter.id ?? "",
        matterNumber: matter.matter_number ?? "",
        users: matter.user_count ?? 0,
        queries: matter.total_events ?? 0,
      };
    });
}
