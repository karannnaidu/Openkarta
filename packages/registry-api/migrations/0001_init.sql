-- 0001_init: hosted registry schema (Plan 03)

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  github_login TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX idx_magic_links_expires ON magic_links(expires_at);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL,
  manifest_url TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('lite','http','agentic')),
  supported_item_types TEXT NOT NULL,
  regions TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  public_key TEXT,
  verification_status TEXT NOT NULL CHECK(verification_status IN ('pending','verified','delisted')),
  health_status TEXT NOT NULL CHECK(health_status IN ('unknown','healthy','stale','delisted')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_agents_health ON agents(health_status);
CREATE INDEX idx_agents_verification ON agents(verification_status);
CREATE INDEX idx_agents_account ON agents(account_id);

CREATE TABLE verifications (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL CHECK(status IN ('pending','passed','failed','expired')),
  PRIMARY KEY (agent_id, token)
);

CREATE TABLE badge_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  ran_at INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  tests_passed INTEGER NOT NULL,
  tests_failed INTEGER NOT NULL,
  packs TEXT NOT NULL DEFAULT '[]',
  error_summary TEXT,
  signed_badge TEXT NOT NULL
);
CREATE INDEX idx_badge_runs_agent_ran ON badge_runs(agent_id, ran_at DESC);

CREATE TABLE email_log (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK(kind IN ('magic_link','verification_passed','stale','delisted','back_to_healthy','transfer_invite')),
  sent_at INTEGER NOT NULL,
  provider_id TEXT
);

CREATE TABLE transfer_invites (
  token TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  from_account_id TEXT NOT NULL REFERENCES accounts(id),
  to_email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
