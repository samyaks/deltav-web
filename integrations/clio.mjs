import { assertNoContent } from "./guard.mjs";

// Clio Manage exports matters and time entries as CSV. Raw Clio columns can
// include notes, activity descriptions, and matter display names that embed a
// client name. These mappers only keep the firm's matter number, the person,
// hours, rate, and status.

function rowsOf(rows, label) {
  if (!Array.isArray(rows)) {
    throw new Error(`Clio ${label} is a list of rows.`);
  }
  return rows;
}

export function mapClioTime(rows) {
  return rowsOf(rows, "time entries").map((row) => {
    assertNoContent(row, "Clio");
    const user = row.user ?? row.activity_user ?? row.member ?? "";
    if (!user) throw new Error("Clio time needs a user.");
    const matterNumber = row.matter_number ?? "";
    if (!matterNumber) throw new Error("Clio time needs a matter_number.");
    const hours = Number(row.hours ?? row.quantity ?? 0);
    const rate = Number(row.rate ?? row.price ?? 0);
    return {
      tool: "Clio",
      id: row.id == null ? "" : String(row.id),
      user,
      at: row.at ?? row.date ?? "",
      matterNumber,
      hours: Number.isFinite(hours) ? hours : 0,
      rate: Number.isFinite(rate) ? rate : 0,
    };
  });
}

export function mapClioMatters(rows) {
  return rowsOf(rows, "matters").map((row) => {
    assertNoContent(row, "Clio");
    const matterNumber = row.matter_number ?? "";
    if (!matterNumber) throw new Error("Clio matters needs a matter_number.");
    return {
      tool: "Clio",
      id: row.id == null ? "" : String(row.id),
      matterNumber,
      status: row.status ?? "",
    };
  });
}
