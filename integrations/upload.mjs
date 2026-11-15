import { expectHeaders, parseCsv } from "./csv.mjs";
import { assertNoContent } from "./guard.mjs";
import { mapHarveyMatters, mapHarveyUsage } from "./harvey.mjs";
import { mapLegoraAudit, mapLegoraCredits } from "./legora.mjs";

// One file per feed. Dates are UTC, written 2026-02-22T14:01:23Z.
// matter_number and project stay text, so 1234.56 is not read as a number.
// A prompt, an answer, a document, or a client name is not a column.

export const HARVEY_USAGE_HEADERS = ["user", "at", "matter_number", "product", "action", "id"];
export const HARVEY_MATTERS_HEADERS = ["matter_number", "users", "queries", "id"];
export const LEGORA_CREDITS_HEADERS = ["member", "feature", "project", "credits", "at"];
export const LEGORA_AUDIT_HEADERS = ["member", "action", "at"];

export function parseHarveyUsageCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, HARVEY_USAGE_HEADERS, "Harvey usage");
  return mapHarveyUsage(records.map((record) => {
    assertNoContent(record, "Harvey");
    if (!record.user) throw new Error("Harvey usage needs a user.");
    return {
      unique_usage_id: record.id,
      user: record.user,
      utc_time: record.at,
      cm_id: record.matter_number,
      product_surface_area: record.product,
      action: record.action,
    };
  }));
}

export function parseHarveyMattersCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, HARVEY_MATTERS_HEADERS, "Harvey matters");
  return mapHarveyMatters({
    client_matters: records.map((record) => {
      assertNoContent(record, "Harvey");
      if (!record.matter_number) throw new Error("Harvey matters needs a matter_number.");
      return {
        id: record.id,
        matter_number: record.matter_number,
        user_count: wholeNumber(record.users, "Harvey matters users"),
        total_events: wholeNumber(record.queries, "Harvey matters queries"),
      };
    }),
  });
}

export function parseLegoraCreditsCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, LEGORA_CREDITS_HEADERS, "Legora credits");
  return mapLegoraCredits(records.map((record) => {
    assertNoContent(record, "Legora");
    return {
      member: record.member,
      feature: record.feature,
      project: record.project,
      credits: amount(record.credits, "Legora credits"),
      at: record.at,
    };
  }));
}

export function parseLegoraAuditCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, LEGORA_AUDIT_HEADERS, "Legora audit");
  return mapLegoraAudit(records.map((record) => {
    assertNoContent(record, "Legora");
    return { member: record.member, action: record.action, at: record.at };
  }));
}

function wholeNumber(value, label) {
  if (value === "") return 0;
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole number.`);
  return Number(value);
}

function amount(value, label) {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`${label} must be a number.`);
  return Number(value);
}
