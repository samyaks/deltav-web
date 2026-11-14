import { assertNoContent } from "./guard.mjs";

// Legora publishes no usage API and no export header. Admins can see credit
// usage by member, feature, and project, and can export an audit of who did
// what, and when. These mappers accept that shape and refuse content fields.

function rowsOf(rows, label) {
  if (!Array.isArray(rows)) {
    throw new Error(`Legora ${label} is a list of rows.`);
  }
  return rows;
}

export function mapLegoraCredits(rows) {
  return rowsOf(rows, "credit usage").map((row) => {
    assertNoContent(row, "Legora");
    const user = row.member ?? row.user ?? "";
    if (!user) throw new Error("Legora credit usage needs a member.");
    return {
      tool: "Legora",
      user,
      feature: row.feature ?? "",
      project: row.project ?? row.matter ?? "",
      credits: row.credits ?? null,
      at: row.at ?? row.date ?? "",
    };
  });
}

export function mapLegoraAudit(rows) {
  return rowsOf(rows, "audit export").map((row) => {
    assertNoContent(row, "Legora");
    const user = row.member ?? row.user ?? "";
    if (!user) throw new Error("Legora audit export needs a member.");
    if (!row.action) throw new Error("Legora audit export needs an action.");
    return {
      tool: "Legora",
      user,
      action: row.action,
      at: row.at ?? row.time ?? row.date ?? "",
    };
  });
}
