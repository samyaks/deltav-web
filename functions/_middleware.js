// Serve the law-firms page for personal outreach links like /law-firms/KyleA,
// without changing the URL. Real routes (talk, insights, intake, notes) pass
// through. Top-level codes like /KyleA still rely on Cloudflare's home-page
// fallback for unknown paths.

const LAW_CODE = /^\/law-firms\/([A-Za-z0-9]{2,40})\/?$/;
const RESERVED = new Set(["talk", "insights", "intake", "notes"]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const match = url.pathname.match(LAW_CODE);
  if (match && !RESERVED.has(match[1].toLowerCase())) {
    const asset = new URL("/law-firms/index.html", url.origin);
    return context.env.ASSETS.fetch(asset);
  }
  return context.next();
}
