// Local preview server: serves public/ at http://localhost:8080.
// No dependencies. Usage: npm run dev  (or: node scripts/dev.mjs [port])

import { createServer } from "node:http";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { INSERT_LEAD, saveLead } from "../functions/_lib/lead.js";

const root = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const leadsFile = resolve(fileURLToPath(new URL("../data/leads.jsonl", import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8080);

const localDb = {
  prepare(sql) {
    if (sql !== INSERT_LEAD) throw new Error("Unexpected lead statement.");
    return {
      bind(...values) {
        return {
          async run() {
            await mkdir(resolve(leadsFile, ".."), { recursive: true });
            const [name, email, business, source, createdAt] = values;
            await appendFile(leadsFile, `${JSON.stringify({ name, email, business, source, created_at: createdAt })}\n`);
          },
        };
      },
    };
  },
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) return null; // path traversal
  try {
    const s = await stat(target);
    if (s.isDirectory()) return resolveFile(join(decoded, "index.html"));
    return target;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];
  if (req.method === "POST" && path === "/api/interest") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = {};
    if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
    if (req.headers.accept) headers.accept = req.headers.accept;
    const request = new Request("http://127.0.0.1/api/interest", {
      method: "POST",
      headers,
      body: Buffer.concat(chunks),
    });
    const response = await saveLead(request, localDb);
    res.writeHead(response.status, {
      "content-type": response.headers.get("content-type"),
      "cache-control": "no-store",
    });
    return res.end(Buffer.from(await response.arrayBuffer()));
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    return res.end("Method not allowed");
  }
  const file = await resolveFile(req.url || "/");
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  res.end(await readFile(file));
});

server.listen(port, () => {
  console.log(`Delta-V site running at http://localhost:${port}`);
});
