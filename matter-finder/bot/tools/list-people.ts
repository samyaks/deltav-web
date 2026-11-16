import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

import {
  PEOPLE_CAP,
  PEOPLE_INDEX_KEY,
  asIndex,
  asPerson,
  type PersonRecord,
} from "../lib/people";

export default defineTool({
  description:
    "List the law-firm operators saved so far, with how many of the 100 spots remain. Does not write messages.",
  effect: "read",
  inputSchema: z.object({
    role: z.enum(["ai_seats", "matter_economics"]).optional(),
    inTargetBand: z.boolean().optional(),
  }),
  async execute(input, ctx) {
    const index = asIndex(await ctx.host.kv.get(PEOPLE_INDEX_KEY));
    const people: PersonRecord[] = [];
    for (const key of index) {
      const person = asPerson(await ctx.host.kv.get(key));
      if (!person) continue;
      if (input.role && person.role !== input.role) continue;
      if (input.inTargetBand !== undefined && person.inTargetBand !== input.inTargetBand) {
        continue;
      }
      people.push(person);
    }
    const targetBandCount = people.filter((person) => person.inTargetBand === true).length;
    return {
      count: people.length,
      targetBandCount,
      remainingTo100: Math.max(0, PEOPLE_CAP - index.length),
      people,
    };
  },
});
