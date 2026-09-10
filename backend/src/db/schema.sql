-- JobJet database schema
-- Run via: npm run migrate  (backend/src/db/migrate.js)
-- Safe to re-run: uses IF NOT EXISTS everywhere.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- USERS & AUTH
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  -- Expo push token for this device (e.g. "ExponentPushToken[...]"), used to
  -- notify the user when a company replies to one of their applications.
  -- One token per user for now (last device to register wins) - good enough
  -- since this is a single-device personal-use app.
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
-- Safe to re-run against a database created before push_token existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Gmail OAuth connection status, surfaced directly on the user row so the
-- frontend can check "is Gmail connected" without decrypting anything.
-- The actual OAuth tokens (refresh_token/access_token, encrypted) live in
-- api_credentials under provider = 'gmail', same as every other per-user
-- secret in this app - these two columns are just a fast, non-secret status
-- flag + display email, kept in sync by gmailController.js.
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_email VARCHAR(255);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id);

-- =========================================================
-- PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  current_location VARCHAR(255),
  country VARCHAR(255),
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  other_links JSONB DEFAULT '[]'::jsonb,
  headline VARCHAR(255),
  about_me TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  programming_languages JSONB DEFAULT '[]'::jsonb,
  frameworks JSONB DEFAULT '[]'::jsonb,
  databases JSONB DEFAULT '[]'::jsonb,
  tools JSONB DEFAULT '[]'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  projects JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- DOCUMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL, -- resume, project_list, cover_letter, portfolio, certificate, other
  file_type VARCHAR(50),
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id);

-- =========================================================
-- API CREDENTIALS (per-user, encrypted at rest)
-- =========================================================

CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'groq' | 'hunter' | 'gmail' (JSON: refresh_token/access_token/expires_at) | future providers
  encrypted_key TEXT NOT NULL,
  key_iv TEXT NOT NULL,
  key_auth_tag TEXT NOT NULL,
  last_four VARCHAR(8), -- for display purposes only, never the full key
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_api_credentials_user ON api_credentials (user_id);

-- =========================================================
-- COMPANIES / JOBS / CONTACTS (discovery results, per-user)
-- =========================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  website TEXT,
  career_page_url TEXT,
  work_mode VARCHAR(20), -- remote | hybrid | onsite | unknown
  industry VARCHAR(255),
  source VARCHAR(100),
  career_details_extracted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, website)
);
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies (user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title VARCHAR(255),
  location VARCHAR(255),
  work_mode VARCHAR(20),
  job_url TEXT,
  description TEXT,
  source VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs (user_id);

CREATE TABLE IF NOT EXISTS company_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email VARCHAR(255),
  contact_type VARCHAR(50), -- careers, jobs, hiring, recruitment, hr, info, contact, other
  confidence NUMERIC(5,2),
  source VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_contacts_company ON company_contacts (company_id);

-- =========================================================
-- APPLICATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies (id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs (id) ON DELETE SET NULL,
  recipient_email VARCHAR(255),
  subject TEXT,
  body TEXT,
  selected_document_ids JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- draft | generated | ready_to_send | sent | replied | interview | rejected | archived
  sent_at TIMESTAMPTZ,
  message_id VARCHAR(255), -- provider message id, for reply threading
  thread_id VARCHAR(255),
  has_unread_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A plain UNIQUE(user_id, company_id, job_id, recipient_email) constraint
-- would NOT catch duplicates here, because SQL treats every NULL as distinct
-- from every other NULL - and job_id/recipient_email are frequently NULL
-- (company-level applications, or before a contact email is found). This
-- expression index normalizes NULLs to a fixed sentinel so duplicates are
-- actually rejected in that common case.
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_dedupe ON applications (
  user_id,
  company_id,
  COALESCE(job_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(recipient_email, '')
);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications (user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_thread ON applications (thread_id);

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL, -- outbound | inbound
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  subject TEXT,
  body TEXT,
  provider_message_id VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_messages_application ON email_messages (application_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_user ON email_messages (user_id);
-- Prevents the same inbound message being recorded twice across repeated
-- IMAP reply checks (Message-ID header is unique per email).
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_provider_msg
  ON email_messages (provider_message_id) WHERE provider_message_id IS NOT NULL;

-- =========================================================
-- APPLICATION SETTINGS (per user preferences)
-- =========================================================

CREATE TABLE IF NOT EXISTS application_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  default_company_search_limit INTEGER NOT NULL DEFAULT 20,
  default_location VARCHAR(255),
  remote_preference VARCHAR(20) DEFAULT 'any', -- remote | hybrid | onsite | any
  preferred_job_types JSONB DEFAULT '[]'::jsonb,
  default_document_ids JSONB DEFAULT '[]'::jsonb,
  email_signature TEXT,
  application_tone VARCHAR(50) DEFAULT 'professional',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
