#!/usr/bin/env node
// Copy the browser-safe integration modules and example CSVs into public/
// so the intake page can import them with no build step on Cloudflare Pages.

import { copyFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(root, "integrations");
const target = resolve(root, "public/integrations");
const examplesSource = resolve(source, "examples");
const examplesTarget = resolve(target, "examples");

mkdirSync(target, { recursive: true });

const files = readdirSync(source).filter((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs"));
for (const name of files) {
  copyFileSync(resolve(source, name), resolve(target, name));
}

cpSync(examplesSource, examplesTarget, { recursive: true });

console.log(`Synced ${files.length} modules and examples to public/integrations/`);
