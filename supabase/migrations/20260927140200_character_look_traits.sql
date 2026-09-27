-- Character look traits from the avatar builder (creation flow v2, 2026-09-27).
--
-- glasses: "none" or "{shape}-{frame colour}" (src/lib/avatar/manifest.ts,
--          e.g. "round-dark", "square-red"); freckles: the freckles overlay.
-- Both feed the Character Bible (src/lib/ai/character-description.ts): the
-- generate route passes them to the preview, and POST /api/characters/prepare
-- hashes the same Bible, so a prepared child sheet is only reused when they match.
--
-- Additive only (defaults = the previous implicit look). Apply before deploying
-- the code that writes them.

alter table public.characters
  add column if not exists glasses text not null default 'none',
  add column if not exists freckles boolean not null default false;

alter table public.characters drop constraint if exists characters_glasses_check;
alter table public.characters
  add constraint characters_glasses_check check (glasses ~ '^(none|[a-z]+-[a-z]+)$');
