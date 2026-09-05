-- Store the author's chapter positions on the visual graph editor.
alter table public.chapters
  add column if not exists layout jsonb;
