-- Add DPDP consent tracking to scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS dpdp_consent_given boolean DEFAULT false;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS dpdp_consent_at timestamptz;

COMMENT ON COLUMN scans.dpdp_consent_given IS 'DPDP Act 2023: user consent for personal data processing';
COMMENT ON COLUMN scans.dpdp_consent_at IS 'Timestamp when consent was given';
