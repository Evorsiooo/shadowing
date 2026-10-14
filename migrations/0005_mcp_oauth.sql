-- The per-user MCP server (/mcp). AI apps (Claude, ChatGPT, Gemini) connect with OAuth: they register
-- themselves (dynamic client registration), the user approves them on a consent page, and they get
-- tokens tied to that one user. Only SHA-256 hashes of codes and tokens are stored.

-- Apps that registered themselves. Anyone can register; nothing is reachable until a user approves.
CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT,
  redirect_uris TEXT NOT NULL,     -- JSON array
  created INTEGER NOT NULL
);

-- A sign-in in progress: the app's request, waiting for the user to approve it (10 minutes).
CREATE TABLE IF NOT EXISTS oauth_requests (
  id TEXT PRIMARY KEY,             -- random, in the consent page's URL and form
  client_id TEXT NOT NULL,
  user_id TEXT,                    -- set once a signed-in user opens the consent page
  params TEXT NOT NULL,            -- JSON: redirect_uri, state, code_challenge, scope, resource
  expires INTEGER NOT NULL
);

-- One row per app a user has approved. Tokens belong to a grant; deleting it disconnects the app.
CREATE TABLE IF NOT EXISTS oauth_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT,
  redirect_host TEXT,
  scope TEXT NOT NULL,
  created INTEGER NOT NULL,
  last_used INTEGER
);
CREATE INDEX IF NOT EXISTS oauth_grants_user ON oauth_grants (user_id);

-- Authorization codes (one use, 5 minutes), access tokens (1 hour) and refresh tokens (rotated, 60 days).
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,             -- hex SHA-256 of the code or token
  kind TEXT NOT NULL,              -- 'code' | 'access' | 'refresh'
  grant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  data TEXT,                       -- codes only: JSON {redirect_uri, code_challenge}
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_tokens_grant ON oauth_tokens (grant_id);
CREATE INDEX IF NOT EXISTS oauth_tokens_expires ON oauth_tokens (expires);
