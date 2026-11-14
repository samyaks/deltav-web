// Saves a name, email, and business name. Nothing else from the form is kept.

export const INSERT_LEAD =
  "INSERT INTO leads (name, email, business, source, created_at) VALUES (?, ?, ?, ?, ?)";

const SOURCES = new Set(["software", "law-firms"]);
const MAX_BODY = 8000;

export async function saveLead(request, db) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  const reply = (status, body) => respond(status, body, wantsJson);

  let data;
  try {
    data = await readBody(request);
  } catch (error) {
    return reply(error.status || 400, { error: error.message || "That form could not be read." });
  }

  if (filled(data.website)) return reply(200, { ok: true });

  const name = clean(data.name, 120);
  const email = clean(data.email, 200).toLowerCase();
  const business = clean(data.business, 200);
  const source = clean(data.source, 40);

  if (!name) return reply(400, { error: "Add your name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Add a valid email." });
  if (!business) return reply(400, { error: "Add your business name." });
  if (!SOURCES.has(source)) return reply(400, { error: "That form could not be read." });
  if (!db) return reply(503, { error: "We could not save that. Email partners@deltav.info." });

  try {
    await db
      .prepare(INSERT_LEAD)
      .bind(name, email, business, source, new Date().toISOString())
      .run();
  } catch (error) {
    console.error("lead insert failed", error instanceof Error ? error.message : "unknown");
    return reply(503, { error: "We could not save that. Email partners@deltav.info." });
  }

  return reply(200, { ok: true });
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) {
    const error = new Error("That form is too large.");
    error.status = 413;
    throw error;
  }
  if (text.trim() === "") {
    const error = new Error("That form could not be read.");
    error.status = 400;
    throw error;
  }
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const error = new Error("That form could not be read.");
      error.status = 400;
      throw error;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const error = new Error("That form could not be read.");
      error.status = 400;
      throw error;
    }
    return parsed;
  }
  return Object.fromEntries(new URLSearchParams(text));
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  const text = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length > max) return "";
  return text;
}

function filled(value) {
  return typeof value === "string" && value.trim() !== "";
}

function respond(status, body, wantsJson) {
  if (wantsJson) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const message = body.ok
    ? "Thanks. We have your name, email, and business, and will be in touch."
    : body.error;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${body.ok ? "Thanks" : "Try again"} · Delta-V</title>
</head>
<body>
<p>${escapeHtml(message)}</p>
<p><a href="/">Software and AI companies</a> · <a href="/law-firms/">Law firms</a></p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
