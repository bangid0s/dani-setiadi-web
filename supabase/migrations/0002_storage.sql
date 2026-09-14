-- ============================================================================
-- Storage buckets (PRD §10.3: buckets `media` and `files`, public read,
-- writes only from the server).
--
-- Both buckets are public-read so next/image and plain <img> can fetch without
-- a signed URL. Uploads and deletes happen server-side with the service role,
-- which bypasses these policies — so no insert/update/delete policy is granted
-- to anon or authenticated, and the browser cannot write.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 20971520,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads media bucket" on storage.objects;
create policy "public reads media bucket" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists "public reads files bucket" on storage.objects;
create policy "public reads files bucket" on storage.objects
  for select to anon, authenticated using (bucket_id = 'files');
