// Local preview server: serves public/ and fakes the form backend.
// No dependencies. Usage: npm run dev  (or: node scripts/dev.mjs [port])
//
// Form POSTs are logged to the console instead of being stored, so you can
// check the sign-up flow end to end before deploying.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8080);

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
  if (req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const fields = Object.fromEntries(new URLSearchParams(body));
    console.log(`[form] ${fields["form-name"] || "form"}:`, fields.email || fields);
    if ((req.headers.accept || "").includes("application/json")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    }
    res.writeHead(303, { Location: "/thanks/" });
    return res.end();
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
