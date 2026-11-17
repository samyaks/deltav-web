// POST /api/leads: stores one design partner intake from /talk in D1.
// The option lists below must match the ones in public/talk/index.html.
// Gmail and Yahoo addresses are rejected with the same rule as public/email-domain.js.
// Never log personal data.

import { isGmailOrYahoo, WORK_EMAIL_ERROR } from "../email-domain.js";

const ROLES = [
  "Engineering leadership",
  "Finance or FinOps",
  "Platform or DevEx",
  "Product",
  "Founder or executive",
  "Other",
];
const TEAM_SIZES = ["1 to 25", "26 to 100", "101 to 500", "501 to 2,000", "2,000+"];
const AI_TOOLS = [
  "GitHub Copilot",
  "Cursor",
  "Claude Code",
  "ChatGPT or OpenAI API",
  "Anthropic API",
  "Gemini",
  "Other",
];
const MONTHLY_SPEND = ["Under $10k", "$10k to $50k", "$50k to $250k", "Over $250k", "Not sure"];
const SOURCES = ["talk-to-us", "book-20-minutes"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const SHORT_MAX = 200;
const QUESTION_MAX = 500;
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function oneOf(value, allowed) {
  return allowed.includes(value) ? value : null;
}

async function passesTurnstile(token, secret, ip) {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json(405, { ok: false, errors: { form: "Method not allowed." } });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, errors: { form: "Something went wrong. Try again in a minute." } });
  }
  if (!body || typeof body !== "object") {
    return json(400, { ok: false, errors: { form: "Something went wrong. Try again in a minute." } });
  }

  // Honeypot: a real person never fills this in. Look successful, store nothing.
  if (asString(body.website)) return json(200, { ok: true });

  const email = asString(body.email).toLowerCase();
  const name = asString(body.name).slice(0, SHORT_MAX);
  const company = asString(body.company).slice(0, SHORT_MAX);
  const role = oneOf(asString(body.role), ROLES);
  const teamSize = oneOf(asString(body.team_size), TEAM_SIZES);
  const question = asString(body.question);

  const tools = Array.isArray(body.ai_tools) ? body.ai_tools.map(asString) : [];
  const aiTools = AI_TOOLS.filter((tool) => tools.includes(tool)).join(", ") || null;
  const monthlySpend = oneOf(asString(body.monthly_spend), MONTHLY_SPEND);

  const errors = {};
  if (!email || email.length > EMAIL_MAX || !EMAIL.test(email)) {
    errors.email = "Enter a valid email address.";
  } else if (isGmailOrYahoo(email)) {
    errors.email = WORK_EMAIL_ERROR;
  }
  if (!name) errors.name = "Required.";
  if (!company) errors.company = "Required.";
  if (!role) errors.role = "Choose an option.";
  if (!teamSize) errors.team_size = "Choose an option.";
  if (question.length > QUESTION_MAX) errors.question = "500 characters maximum.";
  if (Object.keys(errors).length > 0) return json(400, { ok: false, errors });

  if (!env.TURNSTILE_SECRET) {
    return json(500, { ok: false, errors: { form: "Something went wrong. Try again in a minute." } });
  }
  const token = asString(body.turnstileToken);
  const ip = request.headers.get("CF-Connecting-IP");
  if (!token || !(await passesTurnstile(token, env.TURNSTILE_SECRET, ip))) {
    return json(400, { ok: false, errors: { turnstile: "Verification failed. Try again." } });
  }

  const source = oneOf(asString(body.source), SOURCES);
  const referrerPath = asString(body.referrer_path).slice(0, SHORT_MAX) || null;
  const utmSource = asString(body.utm_source).slice(0, SHORT_MAX) || null;
  const utmMedium = asString(body.utm_medium).slice(0, SHORT_MAX) || null;
  const utmCampaign = asString(body.utm_campaign).slice(0, SHORT_MAX) || null;

  try {
    await env.DB.prepare(
      `INSERT INTO leads
         (email, name, company, role, team_size, ai_tools, monthly_spend, question,
          source, referrer_path, utm_source, utm_medium, utm_campaign)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        email,
        name,
        company,
        role,
        teamSize,
        aiTools,
        monthlySpend,
        question || null,
        source,
        referrerPath,
        utmSource,
        utmMedium,
        utmCampaign
      )
      .run();
  } catch (err) {
    console.error("leads: insert failed:", err && err.message);
    return json(500, { ok: false, errors: { form: "Something went wrong. Try again in a minute." } });
  }

  return json(200, { ok: true });
}
