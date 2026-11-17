// Work-email rule for /talk. functions/email-domain.js must stay identical.

export const WORK_EMAIL_ERROR = "Gmail and Yahoo addresses aren't accepted.";

// Organization labels for consumer Gmail and Yahoo mailboxes.
// googlemail.com is Gmail. ymail.com and rocketmail.com are Yahoo Mail.
const BLOCKED = new Set(["gmail", "googlemail", "yahoo", "ymail", "rocketmail"]);

// Second labels of country-code suffixes, so yahoo.co.uk and yahoo.com.br count.
const CC_SECOND = new Set(["ac", "co", "com", "edu", "go", "gob", "gov", "mil", "ne", "net", "or", "org"]);

function domainLabels(email) {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\.+$/, "");
  if (!domain) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return null;
  return labels;
}

// True when the address is hosted at Gmail or Yahoo, including country domains
// (yahoo.co.uk, yahoo.com.au) and subdomains (mail.yahoo.com).
export function isGmailOrYahoo(email) {
  const labels = domainLabels(email);
  if (!labels) return false;
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const org =
    labels.length >= 3 && tld.length === 2 && CC_SECOND.has(sld) ? labels[labels.length - 3] : sld;
  return BLOCKED.has(org);
}
