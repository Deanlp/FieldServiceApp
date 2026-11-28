-- People who can sign in. Office users run the business; Technicians do Visits.
CREATE TABLE app_user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,            -- stored lower-case
  role TEXT NOT NULL CHECK (role IN ('office', 'technician')),
  is_owner INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- One-time sign-in codes. Only a hash of the code is stored.
CREATE TABLE sign_in_code (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  failed_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sign_in_code_by_user ON sign_in_code (user_id, created_at);

-- Signed-in sessions. Only a hash of the session token is stored.
CREATE TABLE user_session (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX user_session_by_user ON user_session (user_id);
