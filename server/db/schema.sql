-- ===================================================================
-- DeedFlow — PostgreSQL Schema
-- Migrated from RamadanFlow v3 SQLite, adapted for PostgreSQL
-- All tables use IF NOT EXISTS for idempotent execution
-- ===================================================================

-- ===================================================================
-- CORE TABLES
-- ===================================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'user',
  gender        TEXT DEFAULT 'Male',
  age           INTEGER DEFAULT 30,
  dob           DATE,
  region        TEXT DEFAULT 'KSA',
  score_multiplier  REAL DEFAULT 1.0,
  session_invalidated_at TIMESTAMPTZ,
  frozen        BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive lookups on username and email
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email_lower    ON users (LOWER(email));

-- ---

CREATE TABLE IF NOT EXISTS taraweeh (
  id        SERIAL PRIMARY KEY,
  username  TEXT NOT NULL,
  year      INTEGER NOT NULL,
  date      DATE NOT NULL,
  completed TEXT DEFAULT 'YES',
  rakaat    INTEGER DEFAULT 8,
  UNIQUE(username, date)
);
CREATE INDEX IF NOT EXISTS idx_taraweeh_user_year ON taraweeh(username, year);

-- ---

CREATE TABLE IF NOT EXISTS khatams (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  year         INTEGER NOT NULL,
  type         TEXT NOT NULL,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  para_count   INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_khatams_user_year ON khatams(username, year);

-- ---

CREATE TABLE IF NOT EXISTS quran_progress (
  id          SERIAL PRIMARY KEY,
  khatam_id   TEXT NOT NULL REFERENCES khatams(id) ON DELETE CASCADE,
  para_number INTEGER NOT NULL,
  completed   BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(khatam_id, para_number)
);

-- ---

CREATE TABLE IF NOT EXISTS fasting (
  id        SERIAL PRIMARY KEY,
  username  TEXT NOT NULL,
  year      INTEGER NOT NULL,
  date      DATE NOT NULL,
  completed TEXT DEFAULT 'YES',
  UNIQUE(username, date)
);
CREATE INDEX IF NOT EXISTS idx_fasting_user_year ON fasting(username, year);

-- ---

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ---

CREATE TABLE IF NOT EXISTS azkar (
  id       SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  date     DATE NOT NULL,
  morning  INTEGER DEFAULT 0,
  evening  INTEGER DEFAULT 0,
  UNIQUE(username, date)
);
CREATE INDEX IF NOT EXISTS idx_azkar_user_date ON azkar(username, date);

-- ---

CREATE TABLE IF NOT EXISTS surah_memorization (
  id             SERIAL PRIMARY KEY,
  username       TEXT NOT NULL,
  surah_number   INTEGER NOT NULL,
  surah_name     TEXT NOT NULL,
  total_ayah     INTEGER NOT NULL,
  memorized_ayah INTEGER DEFAULT 0,
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_surah_user ON surah_memorization(username);

-- ---

CREATE TABLE IF NOT EXISTS namaz (
  id       SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  date     DATE NOT NULL,
  prayer   TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'missed',
  UNIQUE(username, date, prayer)
);
CREATE INDEX IF NOT EXISTS idx_namaz_user_date ON namaz(username, date);

-- ---

CREATE TABLE IF NOT EXISTS ramadan_dates (
  id           SERIAL PRIMARY KEY,
  year         INTEGER NOT NULL,
  region       TEXT NOT NULL,
  date         DATE NOT NULL,
  set_by_admin BOOLEAN DEFAULT TRUE,
  note         TEXT DEFAULT '',
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, region)
);

-- ===================================================================
-- SCORING CONFIG
-- ===================================================================

CREATE TABLE IF NOT EXISTS scoring_config (
  key         TEXT PRIMARY KEY,
  value       REAL NOT NULL,
  label       TEXT,
  description TEXT
);

-- Seed defaults only if empty (handled in migrate.js)

-- ===================================================================
-- ANALYTICS TABLES
-- ===================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id         SERIAL PRIMARY KEY,
  session_id TEXT,
  user_id    INTEGER,
  username   TEXT,
  event_type TEXT NOT NULL,
  event_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);

-- ---

CREATE TABLE IF NOT EXISTS analytics_fingerprints (
  id                    SERIAL PRIMARY KEY,
  session_id            TEXT UNIQUE,
  user_id               INTEGER,
  username              TEXT,
  fingerprint_hash      TEXT,
  canvas_hash           TEXT,
  webgl_hash            TEXT,
  webrtc_ips            TEXT,
  navigator_data        TEXT,
  timezone              TEXT,
  locale                TEXT,
  color_scheme          TEXT,
  screen_resolution     TEXT,
  headless_flags        TEXT,
  ja3_hash              TEXT,
  cf_ip_country         TEXT,
  cf_device_type        TEXT,
  cf_connecting_ip_hash TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_fingerprints_user ON analytics_fingerprints(username);

-- ---

CREATE TABLE IF NOT EXISTS analytics_typing_profiles (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL,
  session_id      TEXT,
  avg_dwell_ms    REAL,
  avg_flight_ms   REAL,
  baseline_dwell  REAL,
  baseline_flight REAL,
  deviation_pct   REAL,
  flagged         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---

CREATE TABLE IF NOT EXISTS analytics_anomalies (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT,
  user_id      INTEGER,
  username     TEXT,
  severity     TEXT DEFAULT 'LOW',
  anomaly_type TEXT NOT NULL,
  details      TEXT,
  ip_hash      TEXT,
  cf_ip_country TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_anomalies_severity ON analytics_anomalies(severity);

-- ---

CREATE TABLE IF NOT EXISTS analytics_admin_audit (
  id              SERIAL PRIMARY KEY,
  admin_username  TEXT NOT NULL,
  action          TEXT NOT NULL,
  target_username TEXT,
  before_state    TEXT,
  after_state     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---

CREATE TABLE IF NOT EXISTS analytics_honeypot (
  id         SERIAL PRIMARY KEY,
  session_id TEXT,
  ip_hash    TEXT,
  route      TEXT NOT NULL,
  user_agent TEXT,
  headers    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---

CREATE TABLE IF NOT EXISTS analytics_requests (
  id          SERIAL PRIMARY KEY,
  method      TEXT,
  route       TEXT,
  username    TEXT,
  status_code INTEGER,
  response_ms INTEGER,
  cf_country  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_requests_created ON analytics_requests(created_at);
