-- ============================================
-- Migration: Google OAuth Tokens for Sheets Integration
-- ============================================
-- This migration adds support for OAuth-based Google Sheets integration,
-- replacing the need for service accounts with a user-friendly OAuth flow.

-- Add oauth_tokens column to store encrypted OAuth credentials
ALTER TABLE tenant_integrations 
ADD COLUMN IF NOT EXISTS oauth_tokens JSONB DEFAULT NULL;

-- The oauth_tokens field will contain:
-- {
--   "access_token": "...",
--   "refresh_token": "...",
--   "expires_at": 1234567890,
--   "email": "user@gmail.com",
--   "token_type": "Bearer",
--   "scope": "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
-- }

COMMENT ON COLUMN tenant_integrations.oauth_tokens IS 
  'OAuth tokens for user-authenticated integrations (Google Sheets OAuth flow). Contains access_token, refresh_token, expires_at, and connected email.';

-- Add index for finding integrations by OAuth email (useful for debugging)
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_oauth_email 
ON tenant_integrations ((oauth_tokens->>'email'))
WHERE oauth_tokens IS NOT NULL;

