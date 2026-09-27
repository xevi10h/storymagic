-- Backfill: store object paths instead of public URLs for the `illustrations`
-- bucket (audit 2026-09-27, private children's imagery).
--
-- Optional hygiene — the app already accepts both forms (illustrationPath() parses
-- the path out of a legacy public URL). Idempotent: rows already holding a path
-- (or a non-illustrations URL: showcase, picsum mock, DiceBear) are untouched.
--
--   https://<ref>.supabase.co/storage/v1/object/public/illustrations/<path>[?query]
--     → <path>
--
-- Columns: story_illustrations.image_url, stories.cover_image_url,
-- stories.character_portrait_url, characters.avatar_url, and the refs inside
-- stories.generated_text (imagePlan.avatarUrl, imageAssets.{preview,final}.
-- {mainUrl,extraUrl}, imageAssets.finalCover.url).
-- illustration_library (unused cache table) is left as is.

update public.story_illustrations
set image_url = regexp_replace(image_url, '^https?://[^/]+/storage/v1/object/public/illustrations/([^?#]+).*$', '\1')
where image_url ~ '^https?://[^/]+/storage/v1/object/public/illustrations/';

update public.stories
set cover_image_url = regexp_replace(cover_image_url, '^https?://[^/]+/storage/v1/object/public/illustrations/([^?#]+).*$', '\1')
where cover_image_url ~ '^https?://[^/]+/storage/v1/object/public/illustrations/';

update public.stories
set character_portrait_url = regexp_replace(character_portrait_url, '^https?://[^/]+/storage/v1/object/public/illustrations/([^?#]+).*$', '\1')
where character_portrait_url ~ '^https?://[^/]+/storage/v1/object/public/illustrations/';

update public.characters
set avatar_url = regexp_replace(avatar_url, '^https?://[^/]+/storage/v1/object/public/illustrations/([^?#]+).*$', '\1')
where avatar_url ~ '^https?://[^/]+/storage/v1/object/public/illustrations/';

-- JSON refs: every string value that is an illustrations public URL. jsonb text
-- output never escapes "/", and a URL never contains an unescaped quote.
-- Works whether stories.generated_text is jsonb or text.
do $$
declare
  col_type text;
  pattern constant text := 'https?://[^"/]+/storage/v1/object/public/illustrations/([^"?#]+)[^"]*';
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'stories' and column_name = 'generated_text';

  if col_type = 'jsonb' then
    update public.stories
    set generated_text = regexp_replace(generated_text::text, pattern, '\1', 'g')::jsonb
    where generated_text::text ~ pattern;
  elsif col_type is not null then
    execute format(
      'update public.stories set generated_text = regexp_replace(generated_text::text, %L, %L, %L) where generated_text::text ~ %L',
      pattern, '\1', 'g', pattern
    );
  end if;
end
$$;
