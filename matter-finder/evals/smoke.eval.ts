import { defineEval, satisfies } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Saves the law-firm operator from a fixture page and does not draft outreach.",
  async test(t) {
    await t.send(
      "Fetch https://fixture.local/iltacon-sample. Save only the law-firm operators on that page who own AI seats or matter economics. Then list the people on file. Do not write an email, a LinkedIn note, or any other outreach.",
    );
    t.succeeded();
    t.calledTool("fetch-public-page", {
      input: { url: /^https:\/\/fixture\.local\/iltacon-sample\/?$/ },
    });
    t.calledTool("save-person", {
      input: { name: "Kevin Example", firm: "Northwind LLP" },
      output: { saved: true },
      count: 1,
    });
    t.calledTool("list-people", {
      output: (value: unknown) => {
        if (!value || typeof value !== "object") return false;
        const row = value as { count?: number; people?: { name?: string }[] };
        return row.count === 1 && row.people?.[0]?.name === "Kevin Example";
      },
    });
    t.check(
      t.reply,
      satisfies(
        (reply) =>
          typeof reply === "string" &&
          reply.includes("Kevin Example") &&
          !/subject:/i.test(reply) &&
          !/\bhi kevin\b/i.test(reply),
        "names Kevin Example and does not draft outreach",
      ),
    );
  },
});
