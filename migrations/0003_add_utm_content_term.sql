-- Demo gate stores the rest of the campaign tags from the landing URL.
-- utm_source, utm_medium, and utm_campaign already exist (0001).
-- Apply this in the D1 console, or locally with:
--   npx wrangler d1 migrations apply deltav_leads --local
-- Do not run `wrangler d1 migrations apply --remote` from an agent.
-- Apply it before the demo gate is deployed. Until these columns exist,
-- demo inserts fail and the form asks the visitor to try again.
-- The /talk insert does not use these columns, so that form keeps working
-- before this migration is applied.

ALTER TABLE leads ADD COLUMN utm_content TEXT;
ALTER TABLE leads ADD COLUMN utm_term TEXT;
