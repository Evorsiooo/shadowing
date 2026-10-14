-- Server-only values (e.g. the Discord webhook URL). Never returned by /api/docs or the MCP tools.
CREATE TABLE IF NOT EXISTS private (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
