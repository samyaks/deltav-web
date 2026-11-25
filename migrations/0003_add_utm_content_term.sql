-- Demo gate stores the rest of the campaign tags from the landing URL.
-- utm_source, utm_medium, and utm_campaign already exist (0001).
-- utm_content and utm_term are already on production. They were added by
-- hand in the D1 console. Do not apply this file to production again.
-- Do not run `wrangler d1 migrations apply --remote`.
-- Deploy only publishes the site. It does not run D1 migrations.
-- These statements are for a fresh local database:
--   npx wrangler d1 migrations apply deltav_leads --local

ALTER TABLE leads ADD COLUMN utm_content TEXT;
ALTER TABLE leads ADD COLUMN utm_term TEXT;
