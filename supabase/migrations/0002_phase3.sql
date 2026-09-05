-- Phase 3 additions: reactions, comments, achievements, reader prefs,
-- and Storage bucket bootstrap. Idempotent.

-- ---------------------------------------------------------------------------
-- story_reactions: per-user emoji reactions on a story
-- ---------------------------------------------------------------------------
create table if not exists public.story_reactions (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  emoji    text not null check (char_length(emoji) between 1 and 8),
  at       timestamptz not null default now(),
  primary key (user_id, story_id, emoji)
);

alter table public.story_reactions enable row level security;

drop policy if exists "reactions readable when story readable" on public.story_reactions;
create policy "reactions readable when story readable"
  on public.story_reactions for select
  using (exists (select 1 from public.stories s
                  where s.id = story_id
                    and (s.status <> 'draft' or s.author_id = auth.uid())));

drop policy if exists "user manages own reactions" on public.story_reactions;
create policy "user manages own reactions"
  on public.story_reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- story_comments: threaded-ish comments on a story or specific chapter
-- ---------------------------------------------------------------------------
create table if not exists public.story_comments (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  story_id   uuid not null references public.stories(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists story_comments_story_idx on public.story_comments(story_id, created_at desc);

alter table public.story_comments enable row level security;

drop policy if exists "comments readable when story readable" on public.story_comments;
create policy "comments readable when story readable"
  on public.story_comments for select
  using (exists (select 1 from public.stories s
                  where s.id = story_id
                    and (s.status <> 'draft' or s.author_id = auth.uid())));

drop policy if exists "user writes own comments" on public.story_comments;
create policy "user writes own comments"
  on public.story_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "user manages own comments" on public.story_comments;
create policy "user manages own comments"
  on public.story_comments for update
  using (auth.uid() = user_id);

drop policy if exists "user deletes own comments or author moderates" on public.story_comments;
create policy "user deletes own comments or author moderates"
  on public.story_comments for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.stories s
                where s.id = story_id and s.author_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- achievements: author-declared unlockables per story
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id                uuid primary key default uuid_generate_v4(),
  story_id          uuid not null references public.stories(id) on delete cascade,
  slug              text not null,
  title             text not null,
  description       text,
  icon              text,
  unlock_condition  jsonb,
  created_at        timestamptz not null default now(),
  unique (story_id, slug)
);

alter table public.achievements enable row level security;

drop policy if exists "achievements readable when story readable" on public.achievements;
create policy "achievements readable when story readable"
  on public.achievements for select
  using (exists (select 1 from public.stories s
                  where s.id = story_id
                    and (s.status <> 'draft' or s.author_id = auth.uid())));

drop policy if exists "author manages own achievements" on public.achievements;
create policy "author manages own achievements"
  on public.achievements for all
  using (exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()))
  with check (exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- unlocked_achievements: per-reader unlocks
-- ---------------------------------------------------------------------------
create table if not exists public.unlocked_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  story_id       uuid not null references public.stories(id) on delete cascade,
  at             timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.unlocked_achievements enable row level security;

drop policy if exists "user reads own unlocks" on public.unlocked_achievements;
create policy "user reads own unlocks"
  on public.unlocked_achievements for select
  using (auth.uid() = user_id);

drop policy if exists "user writes own unlocks" on public.unlocked_achievements;
create policy "user writes own unlocks"
  on public.unlocked_achievements for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reader_prefs: per-user reader UI preferences (typewriter speed, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.reader_prefs (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.reader_prefs enable row level security;

drop policy if exists "user manages own prefs" on public.reader_prefs;
create policy "user manages own prefs"
  on public.reader_prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets: covers (public read), assets (public read)
-- Both write via authenticated users; RLS on storage.objects is scoped
-- by owner uid in the object path prefix.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Anyone can read; authenticated users can write into their own prefix
-- (path starts with `<uid>/`).
drop policy if exists "public read covers" on storage.objects;
create policy "public read covers"
  on storage.objects for select
  using (bucket_id in ('covers', 'assets'));

drop policy if exists "auth write covers" on storage.objects;
create policy "auth write covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers', 'assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "auth update covers" on storage.objects;
create policy "auth update covers"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('covers', 'assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "auth delete covers" on storage.objects;
create policy "auth delete covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers', 'assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
