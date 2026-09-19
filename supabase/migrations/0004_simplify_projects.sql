-- ============================================================================
-- 0004_simplify_projects.sql
-- Simplifies the projects schema by replacing junction tables with JSONB columns
-- to prevent connection pool exhaustion and slow loading times.
-- ============================================================================

-- 1. Add JSONB columns
alter table projects 
  add column category_ids jsonb not null default '[]'::jsonb,
  add column tool_ids jsonb not null default '[]'::jsonb,
  add column gallery jsonb not null default '[]'::jsonb,
  add column links jsonb not null default '[]'::jsonb;

-- 2. Backfill category_ids
update projects p set category_ids = coalesce((
  select jsonb_agg(category_id)
  from project_categories
  where project_id = p.id
), '[]'::jsonb);

-- 3. Backfill tool_ids
update projects p set tool_ids = coalesce((
  select jsonb_agg(tool_id)
  from project_tools
  where project_id = p.id
), '[]'::jsonb);

-- 4. Backfill gallery
update projects p set gallery = coalesce((
  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'mediaId', media_id,
      'width', width,
      'caption', caption
    ) order by sort_order asc
  )
  from project_media
  where project_id = p.id
), '[]'::jsonb);

-- 5. Backfill links
update projects p set links = coalesce((
  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'label', label,
      'url', url
    ) order by sort_order asc
  )
  from project_links
  where project_id = p.id
), '[]'::jsonb);

-- 6. Drop the junction tables (this will also drop any RLS policies and indexes on them automatically)
drop table project_categories cascade;
drop table project_tools cascade;
drop table project_media cascade;
drop table project_links cascade;
