import { createHash } from "node:crypto";

import type { JsonValue } from "@grok/agent-sdk";

export const PEOPLE_INDEX_KEY = "people:index";
export const PEOPLE_CAP = 100;

export const ROLES = ["ai_seats", "matter_economics"] as const;
export type PersonRole = (typeof ROLES)[number];

export type PersonRecord = {
  name: string;
  title: string;
  firm: string;
  lawyerCount: number | null;
  inTargetBand: boolean | null;
  role: PersonRole;
  signal: string;
  sourceUrl: string;
  workEmail: string | null;
  linkedinUrl: string | null;
  savedAt: string;
};

export type PageCache = {
  url: string;
  text: string;
  fetchedAt: string;
};

const VENDORS = [
  "litera",
  "harvey",
  "legora",
  "thomson reuters",
  "lexisnexis",
  "lexis nexis",
  "relativity",
  "imanage",
  "clio",
  "intapp",
  "aderant",
  "filevine",
  "everlaw",
  "disco",
  "westlaw",
  "big hand",
  "bighand",
];

const BLOCKED_TITLE =
  /\b(intern|student|recruiter|paralegal|associate)\b/i;

const OUTREACH =
  /^(hi|hello|dear|subject)\b|\b(would love to|reaching out|quick call|book 20|let me know)\b/i;

export function personKey(name: string, firm: string): string {
  const slug = `${firm}|${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
  return `person:${slug}`;
}

export function pageKey(url: string): string {
  const digest = createHash("sha256").update(url).digest("hex");
  return `page:${digest}`;
}

export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function inTargetBand(lawyerCount: number | null): boolean | null {
  if (lawyerCount === null) return null;
  return lawyerCount >= 50 && lawyerCount <= 300;
}

export function isVendorFirm(firm: string): boolean {
  const value = firm.toLowerCase().trim();
  return VENDORS.some(
    (vendor) =>
      value === vendor ||
      value.startsWith(`${vendor} `) ||
      value.startsWith(`${vendor},`),
  );
}

export function titleIsBlocked(title: string): boolean {
  return BLOCKED_TITLE.test(title);
}

export function signalIsOutreach(signal: string): boolean {
  return OUTREACH.test(signal.trim());
}

export function pageHas(page: string, value: string): boolean {
  return page.toLowerCase().includes(value.toLowerCase());
}

export function signalIsGrounded(signal: string, page: string): boolean {
  const words = signal.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  const distinct = [...new Set(words)];
  const hits = distinct.filter((word) => page.toLowerCase().includes(word));
  return hits.length >= 2;
}

export function asPerson(value: JsonValue | undefined): PersonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value;
  if (typeof row.name !== "string" || typeof row.firm !== "string") return null;
  if (typeof row.title !== "string" || typeof row.signal !== "string") return null;
  if (typeof row.sourceUrl !== "string") return null;
  if (row.role !== "ai_seats" && row.role !== "matter_economics") return null;
  return {
    name: row.name,
    title: row.title,
    firm: row.firm,
    lawyerCount: typeof row.lawyerCount === "number" ? row.lawyerCount : null,
    inTargetBand: typeof row.inTargetBand === "boolean" ? row.inTargetBand : null,
    role: row.role,
    signal: row.signal,
    sourceUrl: row.sourceUrl,
    workEmail: typeof row.workEmail === "string" ? row.workEmail : null,
    linkedinUrl: typeof row.linkedinUrl === "string" ? row.linkedinUrl : null,
    savedAt: typeof row.savedAt === "string" ? row.savedAt : "",
  };
}

export function asPage(value: JsonValue | undefined): PageCache | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.url !== "string" || typeof value.text !== "string") return null;
  return {
    url: value.url,
    text: value.text,
    fetchedAt: typeof value.fetchedAt === "string" ? value.fetchedAt : "",
  };
}

export function asIndex(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
