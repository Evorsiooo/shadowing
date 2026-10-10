-- All app records (videos, clips, sessions, recordings, notes, issues, checkins, meta)
-- are JSON documents keyed by collection + id, mirroring the app's storage layer.
CREATE TABLE IF NOT EXISTS docs (
  col TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (col, id)
);
CREATE INDEX IF NOT EXISTS docs_col_updated ON docs (col, updated_at);
