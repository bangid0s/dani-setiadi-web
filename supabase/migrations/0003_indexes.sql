-- Add reverse indexes to foreign keys to avoid full table scans on deletes and updates.

create index if not exists idx_project_categories_category_id on project_categories(category_id);
create index if not exists idx_project_tools_tool_id on project_tools(tool_id);
create index if not exists idx_project_media_media_id on project_media(media_id);
create index if not exists idx_projects_cover_media_id on projects(cover_media_id);
create index if not exists idx_projects_og_image_id on projects(og_image_id);
create index if not exists idx_tools_icon_media_id on tools(icon_media_id);
create index if not exists idx_media_poster_media_id on media(poster_media_id);
create index if not exists idx_site_settings_og_image_id on site_settings(og_image_id);
create index if not exists idx_site_settings_favicon_id on site_settings(favicon_id);
