-- ============================================================================
-- Dani Setiadi portfolio — Supabase / Postgres schema
-- Mirrors PRD §10.1 table for table, with the access rules from §10.3.
--
-- Access model
-- ------------
-- Every query in this app runs on the server (server components, server
-- actions, route handlers) over a privileged Postgres connection, and the app
-- owns its own admin sessions. RLS is still enabled on every table so that a
-- leaked anon/publishable key can only ever read what a visitor could already
-- see on the public site, and can never write.
-- ============================================================================

-- gen_random_uuid() is in Postgres core from 13 onward, so no extension is
-- needed here.

-- ---------------------------------------------------------------- media -----
create table if not exists media (
  id               uuid primary key default gen_random_uuid(),
  source           text not null check (source in ('upload','url','youtube')),
  storage_path     text,
  original_url     text,
  is_hotlinked     boolean not null default false,
  youtube_id       text,
  youtube_is_short boolean not null default false,
  youtube_start    integer,
  title            text,
  mime_type        text,
  bytes            bigint,
  width            integer not null,
  height           integer not null,
  lqip             text,
  dominant_color   text,
  alt_text         text not null default '',
  is_decorative    boolean not null default false,
  focal_x          real not null default 0.5,
  focal_y          real not null default 0.5,
  poster_media_id  uuid references media(id) on delete set null,
  status           text not null default 'ok' check (status in ('ok','broken')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists idx_media_deleted on media(deleted_at);
create index if not exists idx_media_source  on media(source);
create index if not exists idx_media_created on media(created_at desc);

-- ------------------------------------------------------- site settings -----
create table if not exists site_settings (
  id                 integer primary key default 1 check (id = 1),
  site_title_pattern text not null default '%s — Dani Setiadi',
  meta_description   text not null default '',
  og_image_id        uuid references media(id) on delete set null,
  favicon_id         uuid references media(id) on delete set null,
  cv_path            text,
  cv_filename        text,
  contact_email      text not null default '',
  whatsapp_e164      text not null default '',
  whatsapp_message   text not null default '',
  social_links       jsonb not null default '[]'::jsonb,
  availability       jsonb not null default '{}'::jsonb,
  gallery_settings   jsonb not null default '{}'::jsonb,
  ui_labels          jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);

create table if not exists private_settings (
  id                 integer primary key default 1 check (id = 1),
  notification_email text not null default '',
  analytics          jsonb not null default '{}'::jsonb
);

-- ------------------------------------------------------------- chapters ----
create table if not exists sections (
  key        text primary key check (key in ('hero','work','about','contact')),
  label      text not null,
  sort_order integer not null,
  is_visible boolean not null default true,
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- tools ----
create table if not exists tools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  icon_media_id uuid references media(id) on delete set null,
  url           text,
  sort_order    integer not null default 0,
  is_visible    boolean not null default true
);

create table if not exists experiences (
  id          uuid primary key default gen_random_uuid(),
  company     text not null,
  role        text not null default '',
  work_type   text not null default 'Remote',
  start_year  integer,
  start_month integer,
  end_year    integer,
  end_month   integer,
  is_current  boolean not null default false,
  description text not null default '',
  sort_order  integer not null default 0,
  is_visible  boolean not null default true
);

create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order integer not null default 0,
  is_visible boolean not null default true
);

-- ------------------------------------------------------------- projects ----
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null unique,
  client          text,
  year            integer,
  role            text,
  summary         text,
  body            text,
  cover_media_id  uuid references media(id) on delete set null,
  card_ratio      text not null default 'auto',
  open_as         text not null default 'auto',
  external_url    text,
  is_featured     boolean not null default false,
  featured_order  integer,
  status          text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order      double precision not null default 0,
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  og_image_id     uuid references media(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists idx_projects_status on projects(status, deleted_at);
create index if not exists idx_projects_sort   on projects(sort_order);

create table if not exists project_categories (
  project_id  uuid not null references projects(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (project_id, category_id)
);

create table if not exists project_tools (
  project_id uuid not null references projects(id) on delete cascade,
  tool_id    uuid not null references tools(id) on delete cascade,
  primary key (project_id, tool_id)
);

create table if not exists project_media (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  media_id   uuid not null references media(id) on delete cascade,
  sort_order integer not null default 0,
  width      text not null default 'full' check (width in ('full','half')),
  caption    text
);
create index if not exists idx_project_media on project_media(project_id, sort_order);

create table if not exists project_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label      text not null,
  url        text not null,
  sort_order integer not null default 0
);

-- ------------------------------------------------------------- messages ----
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  whatsapp     text,
  project_type text,
  budget       text,
  message      text not null,
  consent      boolean not null default false,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------------- admins ----
-- PRD ADM-02: allowlist only. There is no public sign-up.
create table if not exists admin_users (
  user_id       uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text not null default '',
  role          text not null default 'owner' check (role in ('owner','maintainer')),
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  token      text primary key,
  user_id    uuid not null references admin_users(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_expiry on sessions(expires_at);

-- PRD ADM-04: login rate limiting.
create table if not exists login_attempts (
  id         bigserial primary key,
  identifier text not null,
  at         timestamptz not null default now()
);
create index if not exists idx_login_attempts on login_attempts(identifier, at);

-- ============================================================================
-- Row Level Security (PRD §10.3)
--
-- The app connects with a role that bypasses RLS, so these policies exist to
-- contain a leaked anon key, not to drive the app.
-- ============================================================================

-- Supabase always provides these roles; creating them when missing keeps this
-- migration runnable on a plain Postgres too (and is a no-op on Supabase).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end $$;

alter table media              enable row level security;
alter table site_settings      enable row level security;
alter table private_settings   enable row level security;
alter table sections           enable row level security;
alter table tools              enable row level security;
alter table experiences        enable row level security;
alter table categories         enable row level security;
alter table projects           enable row level security;
alter table project_categories enable row level security;
alter table project_tools      enable row level security;
alter table project_media      enable row level security;
alter table project_links      enable row level security;
alter table messages           enable row level security;
alter table admin_users        enable row level security;
alter table sessions           enable row level security;
alter table login_attempts     enable row level security;

-- Public read: exactly what a visitor can already see on the site.
drop policy if exists "public reads settings" on site_settings;
create policy "public reads settings" on site_settings
  for select to anon, authenticated using (true);

drop policy if exists "public reads visible sections" on sections;
create policy "public reads visible sections" on sections
  for select to anon, authenticated using (is_visible);

drop policy if exists "public reads visible tools" on tools;
create policy "public reads visible tools" on tools
  for select to anon, authenticated using (is_visible);

drop policy if exists "public reads visible experiences" on experiences;
create policy "public reads visible experiences" on experiences
  for select to anon, authenticated using (is_visible);

drop policy if exists "public reads visible categories" on categories;
create policy "public reads visible categories" on categories
  for select to anon, authenticated using (is_visible);

drop policy if exists "public reads published projects" on projects;
create policy "public reads published projects" on projects
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

drop policy if exists "public reads live media" on media;
create policy "public reads live media" on media
  for select to anon, authenticated using (deleted_at is null);

drop policy if exists "public reads project categories" on project_categories;
create policy "public reads project categories" on project_categories
  for select to anon, authenticated using (
    exists (select 1 from projects p
            where p.id = project_id and p.status = 'published' and p.deleted_at is null));

drop policy if exists "public reads project tools" on project_tools;
create policy "public reads project tools" on project_tools
  for select to anon, authenticated using (
    exists (select 1 from projects p
            where p.id = project_id and p.status = 'published' and p.deleted_at is null));

drop policy if exists "public reads project media" on project_media;
create policy "public reads project media" on project_media
  for select to anon, authenticated using (
    exists (select 1 from projects p
            where p.id = project_id and p.status = 'published' and p.deleted_at is null));

drop policy if exists "public reads project links" on project_links;
create policy "public reads project links" on project_links
  for select to anon, authenticated using (
    exists (select 1 from projects p
            where p.id = project_id and p.status = 'published' and p.deleted_at is null));

-- private_settings, messages, admin_users, sessions and login_attempts get no
-- policy at all: with RLS on and nothing granted, anon and authenticated can
-- neither read nor write them.
