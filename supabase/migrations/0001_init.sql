-- ForkedTales initial schema
-- Applies to a fresh Supabase project. Idempotent where practical.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, holds the public handle + role
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique not null,
  display_name text,
  role         text not null default 'reader' check (role in ('reader','author','admin')),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);

drop policy if exists "user manages own profile" on public.profiles;
create policy "user manages own profile"
  on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile when a new auth user shows up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle',
             split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data->>'display_name',
             split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------------
create table if not exists public.stories (
  id                 uuid primary key default uuid_generate_v4(),
  author_id          uuid not null references public.profiles(id) on delete cascade,
  slug               text unique not null,
  title              text not null,
  description        text,
  cover_url          text,
  tags               text[] not null default '{}',
  content_rating     text not null default 'everyone'
                        check (content_rating in ('everyone','teen','mature')),
  warnings           text[] not null default '{}',
  status             text not null default 'draft'
                        check (status in ('draft','ongoing','complete')),
  start_chapter_id   uuid,
  schema_version     int  not null default 1,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists stories_author_idx on public.stories(author_id);
create index if not exists stories_status_idx on public.stories(status);

alter table public.stories enable row level security;

drop policy if exists "published stories readable by all" on public.stories;
create policy "published stories readable by all"
  on public.stories for select
  using (status <> 'draft' or auth.uid() = author_id);

drop policy if exists "author writes own stories" on public.stories;
create policy "author writes own stories"
  on public.stories for all
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- chapters
-- ---------------------------------------------------------------------------
create table if not exists public.chapters (
  id                 uuid primary key default uuid_generate_v4(),
  story_id           uuid not null references public.stories(id) on delete cascade,
  title              text not null,
  "order"            int  not null default 0,
  is_ending          boolean not null default false,
  ending_label       text,
  unlock_condition   jsonb,          -- ConditionNode | null
  draft              boolean not null default true,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists chapters_story_idx on public.chapters(story_id);

alter table public.chapters enable row level security;

drop policy if exists "chapters readable when published or own" on public.chapters;
create policy "chapters readable when published or own"
  on public.chapters for select
  using (
    exists (
      select 1 from public.stories s
       where s.id = story_id
         and (s.author_id = auth.uid() or (s.status <> 'draft' and chapters.draft = false))
    )
  );

drop policy if exists "author writes own chapters" on public.chapters;
create policy "author writes own chapters"
  on public.chapters for all
  using (exists (select 1 from public.stories s
                  where s.id = story_id and s.author_id = auth.uid()))
  with check (exists (select 1 from public.stories s
                       where s.id = story_id and s.author_id = auth.uid()));

-- FK on stories.start_chapter_id (added after chapters exists)
alter table public.stories
  drop constraint if exists stories_start_chapter_fk;
alter table public.stories
  add constraint stories_start_chapter_fk
  foreign key (start_chapter_id) references public.chapters(id) on delete set null;

-- ---------------------------------------------------------------------------
-- blocks: ordered content within a chapter (dialogue, narration, sprite, bgm...)
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  id          uuid primary key default uuid_generate_v4(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  "order"     int  not null default 0,
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists blocks_chapter_idx on public.blocks(chapter_id, "order");

alter table public.blocks enable row level security;

drop policy if exists "blocks follow chapter visibility" on public.blocks;
create policy "blocks follow chapter visibility"
  on public.blocks for select
  using (exists (
    select 1 from public.chapters c join public.stories s on s.id = c.story_id
     where c.id = chapter_id
       and (s.author_id = auth.uid() or (s.status <> 'draft' and c.draft = false))
  ));

drop policy if exists "author writes own blocks" on public.blocks;
create policy "author writes own blocks"
  on public.blocks for all
  using (exists (select 1 from public.chapters c join public.stories s on s.id = c.story_id
                  where c.id = chapter_id and s.author_id = auth.uid()))
  with check (exists (select 1 from public.chapters c join public.stories s on s.id = c.story_id
                       where c.id = chapter_id and s.author_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- choices: edges out of a chapter
-- ---------------------------------------------------------------------------
create table if not exists public.choices (
  id                uuid primary key default uuid_generate_v4(),
  from_chapter_id   uuid not null references public.chapters(id) on delete cascade,
  target_chapter_id uuid references public.chapters(id) on delete set null,
  label             text not null,
  "order"           int  not null default 0,
  show_condition    jsonb,          -- ConditionNode | null
  effects           jsonb not null default '[]'::jsonb, -- Effect[]
  created_at        timestamptz not null default now()
);

create index if not exists choices_from_idx on public.choices(from_chapter_id);
create index if not exists choices_target_idx on public.choices(target_chapter_id);

alter table public.choices enable row level security;

drop policy if exists "choices follow chapter visibility" on public.choices;
create policy "choices follow chapter visibility"
  on public.choices for select
  using (exists (
    select 1 from public.chapters c join public.stories s on s.id = c.story_id
     where c.id = from_chapter_id
       and (s.author_id = auth.uid() or (s.status <> 'draft' and c.draft = false))
  ));

drop policy if exists "author writes own choices" on public.choices;
create policy "author writes own choices"
  on public.choices for all
  using (exists (select 1 from public.chapters c join public.stories s on s.id = c.story_id
                  where c.id = from_chapter_id and s.author_id = auth.uid()))
  with check (exists (select 1 from public.chapters c join public.stories s on s.id = c.story_id
                       where c.id = from_chapter_id and s.author_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- flag_defs: author-declared flag schema per story
-- ---------------------------------------------------------------------------
create table if not exists public.flag_defs (
  id            uuid primary key default uuid_generate_v4(),
  story_id      uuid not null references public.stories(id) on delete cascade,
  key           text not null,
  kind          text not null check (kind in ('bool','int','string','enum')),
  default_value jsonb,
  description   text,
  enum_values   text[],
  created_at    timestamptz not null default now(),
  unique (story_id, key)
);

alter table public.flag_defs enable row level security;

drop policy if exists "flag_defs readable when story readable" on public.flag_defs;
create policy "flag_defs readable when story readable"
  on public.flag_defs for select
  using (exists (select 1 from public.stories s
                  where s.id = story_id
                    and (s.author_id = auth.uid() or s.status <> 'draft')));

drop policy if exists "author writes own flag_defs" on public.flag_defs;
create policy "author writes own flag_defs"
  on public.flag_defs for all
  using (exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()))
  with check (exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- reader_progress: cache of current head + flags per (reader, story, slot)
-- ---------------------------------------------------------------------------
create table if not exists public.reader_progress (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  story_id            uuid not null references public.stories(id) on delete cascade,
  slot                int  not null default 0,
  slot_name           text,
  current_chapter_id  uuid references public.chapters(id) on delete set null,
  visited_chapter_ids uuid[] not null default '{}',
  picked_choice_ids   uuid[] not null default '{}',
  flags               jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  unique (user_id, story_id, slot)
);

create index if not exists reader_progress_user_idx on public.reader_progress(user_id, story_id);

alter table public.reader_progress enable row level security;

drop policy if exists "reader manages own progress" on public.reader_progress;
create policy "reader manages own progress"
  on public.reader_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reader_path: append-only log powering the branching tree view
-- ---------------------------------------------------------------------------
create table if not exists public.reader_path (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  story_id        uuid not null references public.stories(id) on delete cascade,
  slot            int  not null default 0,
  seq             int  not null,
  chapter_id      uuid not null references public.chapters(id) on delete cascade,
  choice_id       uuid references public.choices(id) on delete set null,
  flags_snapshot  jsonb not null default '{}'::jsonb,
  at              timestamptz not null default now(),
  unique (user_id, story_id, slot, seq)
);

create index if not exists reader_path_user_story_idx
  on public.reader_path(user_id, story_id, slot, seq);

alter table public.reader_path enable row level security;

drop policy if exists "reader manages own path" on public.reader_path;
create policy "reader manages own path"
  on public.reader_path for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- discovered_endings
-- ---------------------------------------------------------------------------
create table if not exists public.discovered_endings (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  story_id    uuid not null references public.stories(id) on delete cascade,
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  at          timestamptz not null default now(),
  primary key (user_id, story_id, chapter_id)
);

alter table public.discovered_endings enable row level security;

drop policy if exists "reader manages own endings" on public.discovered_endings;
create policy "reader manages own endings"
  on public.discovered_endings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- events: lightweight analytics log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  story_id   uuid references public.stories(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);

create index if not exists events_story_idx on public.events(story_id, at);

alter table public.events enable row level security;

drop policy if exists "user inserts own events" on public.events;
create policy "user inserts own events"
  on public.events for insert
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "author reads own story events" on public.events;
create policy "author reads own story events"
  on public.events for select
  using (exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));
