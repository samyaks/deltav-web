// POST /api/leads: stores one intake from /talk, /law-firms/talk/, or the demo gate.
// The option lists below must match those forms.
// Never log personal data.

const ROLES = [
  "Engineering leadership",
  "Finance or FinOps",
  "Platform or DevEx",
  "Product",
  "Founder or executive",
  "Managing partner",
  "Innovation or knowledge",
  "Finance",
  "Information technology",
  "Practice group leader",
  "Other",
];
const TEAM_SIZES = [
  "1 to 25",
  "26 to 100",
  "101 to 500",
  "501 to 2,000",
  "2,000+",
  "Under 50",
  "50 to 150",
  "151 to 300",
  "Over 300",
];
const AI_TOOLS = [
  "GitHub Copilot",
  "Cursor",
  "Claude Code",
  "ChatGPT or OpenAI API",
  "Anthropic API",
  "Gemini",
  "AI agents in our own product",
  "Not sure",
  "Harvey",
  "Legora",
  "Everlaw",
  "Microsoft Copilot",
  "Clio",
  "Relativity",
  "Other",
];
const MONTHLY_SPEND = ["Under $10k", "$10k to $50k", "$50k to $250k", "Over $250k", "Not sure"];
const GOALS = [
  "Whether our AI spend is paying off",
  "Which teams and tools are getting value",
  "How to cap or control usage before the bill arrives",
  "Something else",
];
const SOURCES = ["talk-to-us", "book-20-minutes", "free-audit"];
// Demo gate (/ and /demo-access/). One email field. /demo/ does not post.
// team_size is NOT NULL, so these rows store "unknown" rather than a blank.
const DEMO_SOURCES = ["demo", "demo_ad"];
const DEMO_GOAL = "demo_access";
const DEMO_TEAM_SIZE = "unknown";
const OUTREACH = /^[A-Za-z0-9]{1,40}$/;

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

function isUnique(err) {
  const message = err && err.message ? String(err.message) : "";
  return /UNIQUE constraint failed/i.test(message);
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
  // team_size is NOT NULL in SQLite and cannot be dropped in place. Soft form
  // no longer collects it; store "" when absent. Law-firm form may still send one.
  const teamSizeRaw = asString(body.team_size);
  const teamSize = teamSizeRaw ? oneOf(teamSizeRaw, TEAM_SIZES) || "" : "";
  const goalRaw = asString(body.goal);
  const goal = goalRaw ? oneOf(goalRaw, GOALS) : null;
  const question = asString(body.question);
  const outreachRaw = asString(body.outreach_code);
  const outreachCode = outreachRaw && OUTREACH.test(outreachRaw) ? outreachRaw : null;

  const tools = Array.isArray(body.ai_tools) ? body.ai_tools.map(asString) : [];
  const aiTools = AI_TOOLS.filter((tool) => tools.includes(tool)).join(", ") || null;
  const monthlySpend = oneOf(asString(body.monthly_spend), MONTHLY_SPEND);

  const sourceRaw = asString(body.source);
  const isDemo = DEMO_SOURCES.includes(sourceRaw);

  const errors = {};
  if (!email || email.length > EMAIL_MAX || !EMAIL.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  // The demo gate collects an email only. /talk still requires name, company, and role.
  if (!isDemo) {
    if (!name) errors.name = "Required.";
    if (!company) errors.company = "Required.";
    if (!role) errors.role = "Choose an option.";
    if (goalRaw && !goal) errors.goal = "Choose an option.";
    if (question.length > QUESTION_MAX) errors.question = "500 characters maximum.";
  }
  if (Object.keys(errors).length > 0) return json(400, { ok: false, errors });

  if (!env.TURNSTILE_SECRET) {
    return json(500, { ok: false, errors: { form: "Something went wrong. Try again in a minute." } });
  }
  const token = asString(body.turnstileToken);
  const ip = request.headers.get("CF-Connecting-IP");
  if (!token || !(await passesTurnstile(token, env.TURNSTILE_SECRET, ip))) {
    return json(400, { ok: false, errors: { turnstile: "Verification failed. Try again." } });
  }

  const source = isDemo ? sourceRaw : oneOf(sourceRaw, SOURCES);
  const referrerPath = asString(body.referrer_path).slice(0, SHORT_MAX) || null;
  const utmSource = asString(body.utm_source).slice(0, SHORT_MAX) || null;
  const utmMedium = asString(body.utm_medium).slice(0, SHORT_MAX) || null;
  const utmCampaign = asString(body.utm_campaign).slice(0, SHORT_MAX) || null;
  const utmContent = asString(body.utm_content).slice(0, SHORT_MAX) || null;
  const utmTerm = asString(body.utm_term).slice(0, SHORT_MAX) || null;

  try {
    if (isDemo) {
      // utm_content and utm_term are already on production. They were added
      // by hand. Do not apply migration 0003 to production again.
      await env.DB.prepare(
        `INSERT INTO leads
           (email, name, company, role, team_size, goal, ai_tools, monthly_spend, question,
            outreach_code, source, referrer_path, utm_source, utm_medium, utm_campaign,
            utm_content, utm_term)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          email,
          "",
          "",
          "",
          DEMO_TEAM_SIZE,
          DEMO_GOAL,
          null,
          null,
          null,
          outreachCode,
          source,
          referrerPath,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm
        )
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO leads
           (email, name, company, role, team_size, goal, ai_tools, monthly_spend, question,
            outreach_code, source, referrer_path, utm_source, utm_medium, utm_campaign)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          email,
          name,
          company,
          role,
          teamSize,
          goal,
          aiTools,
          monthlySpend,
          question || null,
          outreachCode,
          source,
          referrerPath,
          utmSource,
          utmMedium,
          utmCampaign
        )
        .run();
    }
  } catch (err) {
    // A repeated demo email is still a successful unlock. /talk is unchanged.
    if (isDemo && isUnique(err)) return json(200, { ok: true });
    console.error("leads: insert failed:", err && err.message);
    return json(500, { ok: false, errors: { form: "Something went wrong. Try again in a minute." } });
  }

  return json(200, { ok: true });
}
