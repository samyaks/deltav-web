import { readFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 500_000;
const MAX_REDIRECTS = 3;
const TEXT_CAP = 60_000;

const BLOCKED_HOST =
  /(^|\.)((linkedin|facebook|instagram|twitter|x|tiktok|youtube)\.com)$/i;

const LOCAL_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

export type FetchResult =
  | { ok: true; url: string; text: string }
  | { ok: false; error: string };

function privateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const value = ip.toLowerCase();
    return (
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80")
    );
  }
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function hostAllowed(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (LOCAL_HOST.test(host)) return "That host is not a public page.";
  if (BLOCKED_HOST.test(host)) {
    return "LinkedIn and other social sites are not fetched. Save a LinkedIn URL only when a public page already shows it.";
  }
  if (isIP(host)) return "Fetch a hostname, not an IP address.";
  return null;
}

async function hostResolvesPublic(hostname: string): Promise<string | null> {
  const blocked = hostAllowed(hostname);
  if (blocked) return blocked;
  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    return "That host did not resolve.";
  }
  if (records.length === 0) return "That host did not resolve.";
  if (records.some((record) => privateAddress(record.address))) {
    return "That host resolves to a private address.";
  }
  return null;
}

export function htmlToText(html: string): string {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const withLinks = withoutCode.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
    " $1 ",
  );
  const text = withLinks
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, TEXT_CAP);
}

async function readFixture(url: URL): Promise<FetchResult> {
  const name = url.pathname.replace(/^\//, "");
  if (!/^[a-z0-9-]{1,64}$/.test(name)) {
    return { ok: false, error: "Unknown fixture page." };
  }
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../fixtures",
  );
  try {
    const html = await readFile(path.join(root, `${name}.html`), "utf8");
    return { ok: true, url: url.toString(), text: htmlToText(html) };
  } catch {
    return { ok: false, error: "Unknown fixture page." };
  }
}

async function readBody(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(step.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function fetchOnce(url: URL): Promise<FetchResult> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const blocked = await hostResolvesPublic(current.hostname);
    if (blocked) return { ok: false, error: blocked };
    if (current.port && current.port !== "443") {
      return { ok: false, error: "Only the standard HTTPS port is fetched." };
    }
    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
        headers: {
          accept: "text/html,text/plain;q=0.9",
          "user-agent": "matter-finder/0.1 (public page research)",
        },
      });
    } catch {
      return { ok: false, error: "The page did not load." };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, error: "The page redirected without a destination." };
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { ok: false, error: "The page redirected to an invalid URL." };
      }
      if (next.protocol !== "https:") {
        return { ok: false, error: "Redirects stay on HTTPS." };
      }
      current = next;
      continue;
    }
    if (!response.ok) {
      return { ok: false, error: `The page returned HTTP ${response.status}.` };
    }
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)) {
      return { ok: false, error: "That URL is not an HTML or text page." };
    }
    const body = await readBody(response);
    if (body === null) return { ok: false, error: "The page is larger than the read limit." };
    return { ok: true, url: current.toString(), text: htmlToText(body) };
  }
  return { ok: false, error: "The page redirected too many times." };
}

export async function loadPublicPage(rawUrl: string): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "That URL is invalid." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Only HTTPS pages are fetched." };
  if (url.hostname === "fixture.local") return readFixture(url);
  return fetchOnce(url);
}
