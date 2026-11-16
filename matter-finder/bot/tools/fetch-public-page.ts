import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

import { loadPublicPage } from "../lib/fetch-page";
import { normalizeUrl, pageKey, type PageCache } from "../lib/people";

const SESSION_FETCH_CAP = 80;

export default defineTool({
  description:
    "Read one public HTTPS page and cache its text. Use this before saving a person from that page. Does not open LinkedIn or other social sites.",
  effect: "idempotent",
  inputSchema: z.object({
    url: z.string().trim().min(8).max(2000),
  }),
  async execute({ url }, ctx) {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      return { ok: false as const, error: "Pass an https URL." };
    }
    const countKey = `fetch-count:${ctx.session.id}`;
    const prior = await ctx.host.kv.get(countKey);
    const count = typeof prior === "number" ? prior : 0;
    if (count >= SESSION_FETCH_CAP) {
      return {
        ok: false as const,
        error: `This session already fetched ${SESSION_FETCH_CAP} pages.`,
      };
    }
    const loaded = await loadPublicPage(normalized);
    if (!loaded.ok) return { ok: false as const, error: loaded.error };
    const cache: PageCache = {
      url: normalizeUrl(loaded.url) ?? normalized,
      text: loaded.text,
      fetchedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(pageKey(cache.url), cache);
    await ctx.host.kv.put(countKey, count + 1);
    const preview = cache.text.slice(0, 12_000);
    return {
      ok: true as const,
      url: cache.url,
      characters: cache.text.length,
      text: preview,
      truncated: cache.text.length > preview.length,
    };
  },
});
