# Seed Data Instructions

## Apply seed data to local Supabase

```bash
# Make sure Supabase is running locally
supabase start

# Apply the seed data
supabase db reset --local

# Or apply just the seed file without resetting
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed.sql
```

## What's included in seed.sql

- **Studios (3):**
  - Golden Sound Studio (unfeatured)
  - Mile High Recording (featured #1)
  - The Vault Studios (unfeatured)

- **Services (4):**
  - 1-Hour Recording Session (Golden Sound)
  - Half-Day Session (Mile High)
  - Mixing Service (Mile High)
  - Demo Package (The Vault)

- **Performers (4):**
  - Sarah Mitchell (unfeatured)
  - Jake Anderson (featured #1)
  - Emily Chen (featured #2)
  - Marcus Rivera (unfeatured)

- **Events (4):**
  - Friday Night Open Mic (unfeatured, 7 days from now)
  - Songwriter Showcase (featured #1, 14 days from now)
  - Acoustic Brunch (unfeatured, 3 days from now)
  - Open Mic Night - RiNo (featured #2, 5 days from now)

All IDs use predictable UUIDs (11111111-1111-..., 22222222-2222-..., etc.) for easy reference in testing.
