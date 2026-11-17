// Exports the leads table to leads.csv. Usage: npm run leads:csv [-- --local]
// Reads through wrangler, so it uses the same Cloudflare login as the other D1 commands.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const target = process.argv.includes("--local") ? "--local" : "--remote";
const out = "leads.csv";
const query = "SELECT * FROM leads ORDER BY created_at DESC, id DESC";

const raw = execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "d1", "execute", "deltav_leads", target, "--json", "--command", query],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);

const parsed = JSON.parse(raw.slice(raw.indexOf("[")));
const rows = parsed.flatMap((result) => result.results ?? []);
if (rows.length === 0) {
  console.log("No leads yet. Nothing written.");
  process.exit(0);
}

const columns = Object.keys(rows[0]);
const cell = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csv = [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\n");
writeFileSync(out, csv + "\n");
console.log(`Wrote ${rows.length} row${rows.length === 1 ? "" : "s"} to ${out}`);
