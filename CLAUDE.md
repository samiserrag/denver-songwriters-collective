# Denver Songwriters Collective - Claude Context

## Project Structure

This project uses **git worktrees** for development:

- **Worktree (development):** `/Users/samiserrag/.claude-worktrees/denver-songwriters-collective/optimistic-jennings`
  - This is where code changes are made
  - Branch: `optimistic-jennings` (or other worktree branches)

- **Main repo (production):** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective`
  - This is the public code deployed to Vercel
  - Branch: `main`
  - Live site: https://denver-songwriters-collective.vercel.app

## Deployment Workflow

1. Make changes in the worktree
2. Commit and push to the worktree branch
3. Merge to `main` in the main repo:
   ```bash
   cd /Users/samiserrag/Documents/GitHub/denver-songwriters-collective
   git pull && git merge origin/optimistic-jennings --no-edit && git push
   ```
4. Vercel auto-deploys from main

## Database

- **Supabase Project ID:** `oipozdbfxyskoscsgbfq`
- **Migrations:** Located in `supabase/migrations/`
- Run migrations via Supabase SQL Editor (Dashboard > SQL Editor)

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deployment:** Vercel

## Key Features

- User roles: performer, host, studio, admin
- Blog system with user submissions and admin approval
- Spotlight/featured profiles system
- Event management
- Gallery with albums
- Comments and likes on blog posts
