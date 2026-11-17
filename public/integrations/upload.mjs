import { mapClioMatters, mapClioTime } from "./clio.mjs";
import { expectHeaders, parseCsv } from "./csv.mjs";
import { mapEverlawProjects, mapEverlawUsage } from "./everlaw.mjs";
import { assertNoContent } from "./guard.mjs";
import { mapHarveyMatters, mapHarveyUsage } from "./harvey.mjs";
import { mapLegoraAudit, mapLegoraCredits } from "./legora.mjs";

// One file per feed. Dates are UTC, written 2026-02-22T14:01:23Z.
// matter_number and project stay text, so 1234.56 is not read as a number.
// A prompt, an answer, a document, a note, or a client name is not a column.

export const HARVEY_USAGE_HEADERS = ["user", "at", "matter_number", "product", "action", "id"];
export const HARVEY_MATTERS_HEADERS = ["matter_number", "users", "queries", "id"];
export const LEGORA_CREDITS_HEADERS = ["member", "feature", "project", "credits", "at"];
export const LEGORA_AUDIT_HEADERS = ["member", "action", "at"];
export const EVERLAW_USAGE_HEADERS = ["user", "at", "matter_number", "action", "docs", "id"];
export const EVERLAW_PROJECTS_HEADERS = ["matter_number", "users", "docs", "id"];
export const CLIO_TIME_HEADERS = ["user", "at", "matter_number", "hours", "rate", "id"];
export const CLIO_MATTERS_HEADERS = ["matter_number", "status", "id"];

const FEEDS = [
  { kind: "harvey-usage", headers: HARVEY_USAGE_HEADERS, parse: parseHarveyUsageCsv },
  { kind: "harvey-matters", headers: HARVEY_MATTERS_HEADERS, parse: parseHarveyMattersCsv },
  { kind: "legora-credits", headers: LEGORA_CREDITS_HEADERS, parse: parseLegoraCreditsCsv },
  { kind: "legora-audit", headers: LEGORA_AUDIT_HEADERS, parse: parseLegoraAuditCsv },
  { kind: "everlaw-usage", headers: EVERLAW_USAGE_HEADERS, parse: parseEverlawUsageCsv },
  { kind: "everlaw-projects", headers: EVERLAW_PROJECTS_HEADERS, parse: parseEverlawProjectsCsv },
  { kind: "clio-time", headers: CLIO_TIME_HEADERS, parse: parseClioTimeCsv },
  { kind: "clio-matters", headers: CLIO_MATTERS_HEADERS, parse: parseClioMattersCsv },
];

export function detectFeed(headers) {
  const match = FEEDS.find((feed) => sameHeaders(headers, feed.headers));
  return match ? match.kind : null;
}

export function parseUploadCsv(text, kind) {
  if (kind) {
    const feed = FEEDS.find((entry) => entry.kind === kind);
    if (!feed) throw new Error(`Unknown feed "${kind}".`);
    return { kind: feed.kind, rows: feed.parse(text) };
  }
  const { headers } = parseCsv(text);
  const detected = detectFeed(headers);
  if (!detected) {
    throw new Error(
      "CSV header does not match a known feed. Expected one of: "
      + FEEDS.map((feed) => feed.kind).join(", ")
      + ".",
    );
  }
  return parseUploadCsv(text, detected);
}

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

export function parseEverlawUsageCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, EVERLAW_USAGE_HEADERS, "Everlaw usage");
  return mapEverlawUsage(records.map((record) => {
    assertNoContent(record, "Everlaw");
    if (!record.user) throw new Error("Everlaw usage needs a user.");
    return {
      id: record.id,
      user: record.user,
      at: record.at,
      matter_number: record.matter_number,
      action: record.action,
      docs: wholeNumber(record.docs, "Everlaw usage docs"),
    };
  }));
}

export function parseEverlawProjectsCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, EVERLAW_PROJECTS_HEADERS, "Everlaw projects");
  return mapEverlawProjects(records.map((record) => {
    assertNoContent(record, "Everlaw");
    if (!record.matter_number) throw new Error("Everlaw projects needs a matter_number.");
    return {
      id: record.id,
      matter_number: record.matter_number,
      users: wholeNumber(record.users, "Everlaw projects users"),
      docs: wholeNumber(record.docs, "Everlaw projects docs"),
    };
  }));
}

export function parseClioTimeCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, CLIO_TIME_HEADERS, "Clio time");
  return mapClioTime(records.map((record) => {
    assertNoContent(record, "Clio");
    if (!record.user) throw new Error("Clio time needs a user.");
    if (!record.matter_number) throw new Error("Clio time needs a matter_number.");
    return {
      id: record.id,
      user: record.user,
      at: record.at,
      matter_number: record.matter_number,
      hours: amount(record.hours, "Clio time hours"),
      rate: amount(record.rate === "" ? "0" : record.rate, "Clio time rate"),
    };
  }));
}

export function parseClioMattersCsv(text) {
  const { headers, records } = parseCsv(text);
  expectHeaders(headers, CLIO_MATTERS_HEADERS, "Clio matters");
  return mapClioMatters(records.map((record) => {
    assertNoContent(record, "Clio");
    if (!record.matter_number) throw new Error("Clio matters needs a matter_number.");
    return {
      id: record.id,
      matter_number: record.matter_number,
      status: record.status,
    };
  }));
}

function sameHeaders(actual, expected) {
  return actual.length === expected.length && actual.every((header, index) => header === expected[index]);
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
