# ForkedTales

A platform for publishing and reading branching, visual-novel-style interactive stories.

## Stack

- **Next.js 14 (App Router) + React 18 + TypeScript**
- **Tailwind CSS** for styling
- **Supabase** for Postgres, Auth, and Storage
- **Zustand** for reader runtime state
- **Zod** for schema validation

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project keys
npm run dev
```

Open http://localhost:3000.

## Project structure

```
src/
  app/         Next.js routes (reader, author, api)
  lib/         Shared clients (supabase), condition engine, types
  components/  Reusable UI
supabase/
  migrations/  SQL migrations for the Postgres schema
```

## Roadmap

See the build plan in the repo history. Phase 1 (foundations, linear reading,
auth, CRUD) is being built first; branching, conditions, the graph editor,
tree view, and BGM come in later phases.
