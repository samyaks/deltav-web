import { assertNoContent } from "./guard.mjs";

// Everlaw has no firm-wide usage API. Project admins can export historic user
// activity and review analytics. Those exports can include free-text
// descriptions, so this mapper only keeps counts, the person, the time, and
// the firm's matter number. Description / document / client fields are refused.

function rowsOf(rows, label) {
  if (!Array.isArray(rows)) {
    throw new Error(`Everlaw ${label} is a list of rows.`);
  }
  return rows;
}

export function mapEverlawUsage(rows) {
  return rowsOf(rows, "usage").map((row) => {
    assertNoContent(row, "Everlaw");
    const user = row.user ?? row.member ?? "";
    if (!user) throw new Error("Everlaw usage needs a user.");
    const docs = row.docs ?? row.docs_viewed ?? 0;
    return {
      tool: "Everlaw",
      id: row.id == null ? "" : String(row.id),
      user,
      at: row.at ?? row.date ?? "",
      matterNumber: row.matter_number ?? row.matter ?? row.project ?? "",
      action: row.action ?? "",
      docs: Number(docs) || 0,
    };
  });
}

export function mapEverlawProjects(rows) {
  return rowsOf(rows, "projects").map((row) => {
    assertNoContent(row, "Everlaw");
    const matterNumber = row.matter_number ?? row.matter ?? row.project ?? "";
    if (!matterNumber) throw new Error("Everlaw projects needs a matter_number.");
    return {
      tool: "Everlaw",
      id: row.id == null ? "" : String(row.id),
      matterNumber,
      users: Number(row.users ?? 0) || 0,
      docs: Number(row.docs ?? row.docs_viewed ?? 0) || 0,
    };
  });
}
