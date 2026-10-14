-- Some apps (Gemini) register as confidential clients and expect a client secret back.
-- Only its SHA-256 is kept. last_error records the latest sign-in failure for an app, to diagnose
-- connections that fail on the app's side without showing why.
ALTER TABLE oauth_clients ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'none';
ALTER TABLE oauth_clients ADD COLUMN secret_hash TEXT;
ALTER TABLE oauth_clients ADD COLUMN last_error TEXT;
