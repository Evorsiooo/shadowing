-- Accounts: Google sign-in, per-user data, and the existing data moved to the admin account.
-- Every row that exists today belongs to Adrien, so it is assigned to his user row
-- (evorsio1@gmail.com, role admin). Google links that row to his Google account the first
-- time he signs in with that verified email. Nothing is copied or deleted.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,          -- Google's stable account id; NULL until the first sign-in
  email TEXT NOT NULL UNIQUE,      -- lower-case, verified by Google
  name TEXT,
  picture TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  disabled INTEGER NOT NULL DEFAULT 0,
  invite_code TEXT,                -- the code used to sign up in invite-only mode, if any
  created INTEGER NOT NULL,
  last_seen INTEGER
);

INSERT OR IGNORE INTO users (id, email, role, created)
VALUES (lower(hex(randomblob(16))), 'evorsio1@gmail.com', 'admin', CAST(unixepoch('subsec') * 1000 AS INTEGER));

-- Sign-in sessions. The cookie holds a random token; only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,             -- hex SHA-256 of the cookie token
  user_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- docs: the primary key gains user_id.
CREATE TABLE docs_new (
  user_id TEXT NOT NULL,
  col TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, col, id)
);
INSERT INTO docs_new (user_id, col, id, data, updated_at)
  SELECT (SELECT id FROM users WHERE email = 'evorsio1@gmail.com'), col, id, data, updated_at FROM docs;
DROP TABLE docs;
ALTER TABLE docs_new RENAME TO docs;
CREATE INDEX IF NOT EXISTS docs_user_col_updated ON docs (user_id, col, updated_at);
CREATE INDEX IF NOT EXISTS docs_col ON docs (col, id);

-- private (server-only values such as the Discord webhook): per user too.
CREATE TABLE private_new (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
INSERT INTO private_new (user_id, key, value, updated_at)
  SELECT (SELECT id FROM users WHERE email = 'evorsio1@gmail.com'), key, value, updated_at FROM private;
DROP TABLE private;
ALTER TABLE private_new RENAME TO private;
CREATE INDEX IF NOT EXISTS private_key ON private (key);

-- Who owns each R2 object. New keys are u/<userId>/..., older keys are owned through this table.
CREATE TABLE IF NOT EXISTS files (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  size INTEGER,
  kind TEXT,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS files_user ON files (user_id);
-- backfill from every "r2:<key>" reference and every video's r2Key in the existing data
INSERT OR IGNORE INTO files (key, user_id, kind, created)
  SELECT DISTINCT k, d.user_id, substr(k, 1, instr(k, '/') - 1), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  FROM (
    SELECT docs.user_id AS user_id, substr(j.value, 4) AS k
      FROM docs, json_tree(docs.data) AS j
      WHERE j.type = 'text' AND j.value LIKE 'r2:%'
    UNION
    SELECT docs.user_id, json_extract(docs.data, '$.r2Key')
      FROM docs WHERE docs.col = 'videos' AND json_type(docs.data, '$.r2Key') = 'text'
  ) AS d
  WHERE k GLOB '[a-z]*/*';

-- Site-wide settings the admin page will change, e.g. signup = 'open' | 'invite'.
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('signup', 'open', CAST(unixepoch('subsec') * 1000 AS INTEGER));

-- Invite codes for invite-only mode (created from the admin page).
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  note TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  expires INTEGER,                 -- ms epoch, NULL = never
  created_by TEXT,
  created INTEGER NOT NULL
);

-- Messages from the contact/support form, read on the admin page.
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,                    -- NULL when sent by a visitor who isn't signed in
  email TEXT,
  message TEXT NOT NULL,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'done'
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_created ON support_messages (created);
