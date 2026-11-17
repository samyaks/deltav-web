#!/usr/bin/env node
// Ingest one or more Harvey / Legora / Everlaw CSV uploads and print the
// org / user / matter rollup as JSON.
//
// Usage:
//   node scripts/ingest.mjs path/to/a.csv path/to/b.csv
//   node scripts/ingest.mjs --demo
//   node scripts/ingest.mjs --demo --out public/law-firms/intake/sample.json

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestFeeds } from "../integrations/ingest.mjs";
import { parseUploadCsv } from "../integrations/upload.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
const paths = args.filter((arg, index) => arg !== "--demo" && arg !== "--out" && index !== outIndex + 1);

const demoDir = resolve(root, "integrations/examples/demo");
const files = args.includes("--demo")
  ? readdirSync(demoDir).filter((name) => name.endsWith(".csv")).map((name) => resolve(demoDir, name))
  : paths.map((path) => resolve(path));

if (files.length === 0) {
  console.error("Pass CSV paths, or --demo.");
  process.exit(1);
}

const feeds = files.map((file) => {
  const text = readFileSync(file, "utf8");
  try {
    return parseUploadCsv(text);
  } catch (error) {
    error.message = `${file}: ${error.message}`;
    throw error;
  }
});

const view = ingestFeeds(feeds, {
  seats: [
    { tool: "Harvey", licensed: 10, monthlyCost: 2500 },
    { tool: "Legora", licensed: 6, monthlyCost: 1800 },
    { tool: "Everlaw", licensed: 4, monthlyCost: 1200 },
  ],
});

const json = `${JSON.stringify(view, null, 2)}\n`;
if (outPath) {
  const target = resolve(outPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, json);
  console.error(`Wrote ${target}`);
} else {
  process.stdout.write(json);
}
