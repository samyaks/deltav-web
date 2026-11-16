import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

import {
  PEOPLE_CAP,
  PEOPLE_INDEX_KEY,
  asIndex,
  asPage,
  asPerson,
  inTargetBand,
  isVendorFirm,
  normalizeUrl,
  pageHas,
  pageKey,
  personKey,
  signalIsGrounded,
  signalIsOutreach,
  titleIsBlocked,
  type PersonRecord,
} from "../lib/people";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function linkedinSlug(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/\/in\/([^/?#]+)/i);
  if (!match) return null;
  return decodeURIComponent(match[1]).toLowerCase();
}

export default defineTool({
  description:
    "Save one law-firm operator already printed on a page this session fetched. Stores the published name, title, firm, and any work email or LinkedIn URL that appears on that page. Does not store message text.",
  effect: "idempotent",
  inputSchema: z.object({
    name: z.string().trim().min(3).max(120),
    title: z.string().trim().min(3).max(160),
    firm: z.string().trim().min(2).max(160),
    lawyerCount: z.number().int().min(1).max(20000).nullable().optional(),
    role: z.enum(["ai_seats", "matter_economics"]),
    signal: z.string().trim().min(12).max(240),
    sourceUrl: z.string().trim().min(8).max(2000),
    workEmail: z.string().trim().max(200).nullable().optional(),
    linkedinUrl: z.string().trim().max(300).nullable().optional(),
  }),
  async execute(input, ctx) {
    const sourceUrl = normalizeUrl(input.sourceUrl);
    if (!sourceUrl) {
      return { ok: false as const, saved: false as const, reason: "sourceUrl must be the https page you fetched." };
    }
    const page = asPage(await ctx.host.kv.get(pageKey(sourceUrl)));
    if (!page) {
      return {
        ok: false as const,
        saved: false as const,
        reason: "Fetch that source page first. A person is saved only from text the fetch tool returned.",
      };
    }
    if (!pageHas(page.text, input.name)) {
      return { ok: false as const, saved: false as const, reason: "That name is not on the source page." };
    }
    if (!pageHas(page.text, input.title)) {
      return { ok: false as const, saved: false as const, reason: "Copy the title as the source page prints it." };
    }
    if (!pageHas(page.text, input.firm)) {
      return { ok: false as const, saved: false as const, reason: "That firm name is not on the source page." };
    }
    if (isVendorFirm(input.firm)) {
      return { ok: false as const, saved: false as const, reason: "That employer sells software. Save law-firm operators." };
    }
    if (titleIsBlocked(input.title)) {
      return {
        ok: false as const,
        saved: false as const,
        reason: "That title is an associate, intern, student, recruiter, or paralegal.",
      };
    }
    if (signalIsOutreach(input.signal)) {
      return {
        ok: false as const,
        saved: false as const,
        reason: "The signal is a fact from the page, not a greeting or a message.",
      };
    }
    if (!signalIsGrounded(input.signal, page.text)) {
      return {
        ok: false as const,
        saved: false as const,
        reason: "The signal must use facts that appear on the source page.",
      };
    }

    const workEmail = input.workEmail?.trim() || null;
    if (workEmail) {
      if (!EMAIL.test(workEmail) || !pageHas(page.text, workEmail)) {
        return {
          ok: false as const,
          saved: false as const,
          reason: "Save a work email only when that exact address is on the source page.",
        };
      }
    }

    const linkedinUrl = input.linkedinUrl?.trim() || null;
    if (linkedinUrl) {
      const slug = linkedinSlug(linkedinUrl);
      if (!slug || !pageHas(page.text, `linkedin.com/in/${slug}`)) {
        return {
          ok: false as const,
          saved: false as const,
          reason: "Save a LinkedIn URL only when the source page already shows that /in/ link.",
        };
      }
    }

    const key = personKey(input.name, input.firm);
    const existing = asPerson(await ctx.host.kv.get(key));
    if (existing) {
      return { ok: true as const, saved: false as const, duplicate: true as const, person: existing };
    }

    const index = asIndex(await ctx.host.kv.get(PEOPLE_INDEX_KEY));
    if (index.length >= PEOPLE_CAP) {
      return { ok: false as const, saved: false as const, reason: "The list already has 100 people." };
    }

    const lawyerCount = input.lawyerCount ?? null;
    const person: PersonRecord = {
      name: input.name,
      title: input.title,
      firm: input.firm,
      lawyerCount,
      inTargetBand: inTargetBand(lawyerCount),
      role: input.role,
      signal: input.signal,
      sourceUrl,
      workEmail,
      linkedinUrl,
      savedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(key, { ...person });
    if (!index.includes(key)) {
      await ctx.host.kv.put(PEOPLE_INDEX_KEY, [...index, key]);
    }
    return { ok: true as const, saved: true as const, duplicate: false as const, person };
  },
});
