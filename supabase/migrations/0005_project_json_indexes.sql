-- ============================================================================
-- 0005_project_json_indexes.sql
-- Indexes for the JSONB columns introduced in 0004. The category filter and
-- the "active categories" lookup both use `category_ids @> [...]`; without a
-- GIN index each one reads every project row. Safe to re-run.
-- ============================================================================

create index if not exists idx_projects_category_ids
  on projects using gin (category_ids jsonb_path_ops);

-- The admin list and the public gallery both filter live rows and sort by the
-- manual order; a partial index serves that without touching deleted rows.
create index if not exists idx_projects_live_sort
  on projects (sort_order, created_at desc)
  where deleted_at is null;
