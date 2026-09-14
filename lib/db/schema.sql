-- ============================================================================
-- Dani Setiadi portfolio — schema
-- Mirrors PRD §10.1 (Postgres/Supabase) column-for-column so the data layer can
-- be swapped to Supabase without touching application code. SQLite mappings:
--   uuid -> TEXT   jsonb -> TEXT (JSON)   timestamptz -> TEXT (ISO 8601)
--   bool -> INTEGER (0/1)                 double precision -> REAL
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- singleton (id = 1), public read ------------------------------------------
CREATE TABLE IF NOT EXISTS site_settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  site_title_pattern  TEXT NOT NULL DEFAULT '%s — Dani Setiadi',
  meta_description    TEXT NOT NULL DEFAULT '',
  og_image_id         TEXT REFERENCES media(id) ON DELETE SET NULL,
  favicon_id          TEXT REFERENCES media(id) ON DELETE SET NULL,
  cv_path             TEXT,
  cv_filename         TEXT,
  contact_email       TEXT NOT NULL DEFAULT '',
  whatsapp_e164       TEXT NOT NULL DEFAULT '',
  whatsapp_message    TEXT NOT NULL DEFAULT '',
  social_links        TEXT NOT NULL DEFAULT '[]',
  availability        TEXT NOT NULL DEFAULT '{}',
  gallery_settings    TEXT NOT NULL DEFAULT '{}',
  ui_labels           TEXT NOT NULL DEFAULT '{}',
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- singleton, admin-only -----------------------------------------------------
CREATE TABLE IF NOT EXISTS private_settings (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  notification_email TEXT NOT NULL DEFAULT '',
  analytics          TEXT NOT NULL DEFAULT '{}'
);

-- one row per chapter -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sections (
  key        TEXT PRIMARY KEY,          -- hero | work | about | contact
  label      TEXT NOT NULL,             -- "Intro", "Work"… (number is generated)
  sort_order INTEGER NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1,
  content    TEXT NOT NULL DEFAULT '{}',-- validated by a Zod schema per key (§10.2)
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- media ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL,             -- upload | url | youtube
  storage_path     TEXT,                      -- uploads and imported links
  original_url     TEXT,                      -- the pasted link (url / youtube)
  is_hotlinked     INTEGER NOT NULL DEFAULT 0,
  youtube_id       TEXT,
  youtube_is_short INTEGER NOT NULL DEFAULT 0,
  youtube_start    INTEGER,
  title            TEXT,                      -- file name or YouTube title
  mime_type        TEXT,
  bytes            INTEGER,
  width            INTEGER NOT NULL,
  height           INTEGER NOT NULL,
  lqip             TEXT,
  dominant_color   TEXT,
  alt_text         TEXT NOT NULL DEFAULT '',
  is_decorative    INTEGER NOT NULL DEFAULT 0,
  focal_x          REAL NOT NULL DEFAULT 0.5,
  focal_y          REAL NOT NULL DEFAULT 0.5,
  poster_media_id  TEXT REFERENCES media(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'ok', -- ok | broken
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_media_deleted ON media(deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_source  ON media(source);

CREATE TABLE IF NOT EXISTS tools (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  url           TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_visible    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS experiences (
  id          TEXT PRIMARY KEY,
  company     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  work_type   TEXT NOT NULL DEFAULT 'Remote', -- Remote|On-site|Hybrid|Freelance|Contract
  start_year  INTEGER,
  start_month INTEGER,
  end_year    INTEGER,
  end_month   INTEGER,
  is_current  INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_visible  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  client          TEXT,
  year            INTEGER,
  role            TEXT,
  summary         TEXT,
  body            TEXT,                       -- rich-text document (markdown subset)
  cover_media_id  TEXT REFERENCES media(id) ON DELETE SET NULL,
  card_ratio      TEXT NOT NULL DEFAULT 'auto', -- auto|1:1|4:5|3:4|2:3|16:9|9:16
  open_as         TEXT NOT NULL DEFAULT 'auto', -- auto|lightbox|page|external
  external_url    TEXT,
  is_featured     INTEGER NOT NULL DEFAULT 0,
  featured_order  INTEGER,
  status          TEXT NOT NULL DEFAULT 'draft', -- draft|published|archived
  sort_order      REAL NOT NULL DEFAULT 0,
  published_at    TEXT,
  seo_title       TEXT,
  seo_description TEXT,
  og_image_id     TEXT REFERENCES media(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_sort   ON projects(sort_order);

CREATE TABLE IF NOT EXISTS project_categories (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, category_id)
);

CREATE TABLE IF NOT EXISTS project_tools (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_id    TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tool_id)
);

CREATE TABLE IF NOT EXISTS project_media (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id   TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  width      TEXT NOT NULL DEFAULT 'full',   -- full | half
  caption    TEXT
);
CREATE INDEX IF NOT EXISTS idx_project_media ON project_media(project_id, sort_order);

CREATE TABLE IF NOT EXISTS project_links (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- P1 -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  whatsapp     TEXT,
  project_type TEXT,
  budget       TEXT,
  message      TEXT NOT NULL,
  consent      INTEGER NOT NULL DEFAULT 0,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Allowlist (PRD ADM-02): public sign-up is disabled; admins are invited.
CREATE TABLE IF NOT EXISTS admin_users (
  user_id       TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'owner', -- owner | maintainer
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES admin_users(user_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Login rate limiting (PRD ADM-04)
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(identifier, at);
