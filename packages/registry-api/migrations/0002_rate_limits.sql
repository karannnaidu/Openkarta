-- 0002_rate_limits: per-key cooldown table used by reverify endpoint
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  last_at INTEGER NOT NULL
);
