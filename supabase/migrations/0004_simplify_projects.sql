-- ============================================================================
-- 0004_simplify_projects.sql
-- Simplifies the projects schema by replacing junction tables with JSONB columns
-- to prevent connection pool exhaustion and slow loading times.
-- ============================================================================

-- Safe to re-run: `npm run db:setup` applies every migration each time, and
-- 0001 re-creates the (empty) junction tables. The backfill only runs while
-- the JSONB columns do not exist yet, so a re-run never overwrites real data.
do $migrate$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'gallery'
  ) then
    return;
  end if;

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
end
$migrate$;

-- 6. Drop the junction tables (this will also drop any RLS policies and indexes on them automatically)
drop table if exists project_categories cascade;
drop table if exists project_tools cascade;
drop table if exists project_media cascade;
drop table if exists project_links cascade;
