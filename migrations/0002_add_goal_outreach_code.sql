-- Soft-form redesign: optional goal and outreach attribution.
ALTER TABLE leads ADD COLUMN goal TEXT;
ALTER TABLE leads ADD COLUMN outreach_code TEXT;
