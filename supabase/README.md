# Supabase setup

1. Create a project at https://supabase.com.
2. In `Project Settings → API`, copy `URL`, `anon` key, and `service_role`
   key into `.env.local`.
3. In the SQL editor, run `migrations/0001_init.sql` (or `supabase db push`
   if you use the CLI).
4. Create a public Storage bucket named `covers` for story cover images
   (later phases will add `assets` for sprites, backgrounds, sfx, bgm).

The schema enables Row Level Security on every table. Readers can only
touch their own progress; authors can only mutate their own stories.
