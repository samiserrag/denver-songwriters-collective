-- Account-level saved filters for /happenings recall + digest personalization.
-- Canonical source of truth is DB (not cookies).
-- REVIEWED: policy change acknowledged

create table if not exists public.happenings_saved_filters (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  auto_apply boolean not null default false,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint happenings_saved_filters_filters_is_object
    check (jsonb_typeof(filters) = 'object')
);

comment on table public.happenings_saved_filters is
  'Account-level saved /happenings filters. Used for recall UX and weekly digest personalization.';
comment on column public.happenings_saved_filters.auto_apply is
  'When true, auto-apply saved filters on /happenings when no explicit filter params are present.';
comment on column public.happenings_saved_filters.filters is
  'Sanitized filter payload (type/csc/days/cost/city/zip/radius).';

alter table public.happenings_saved_filters enable row level security;

drop policy if exists "Users can read own happenings saved filters" on public.happenings_saved_filters;
create policy "Users can read own happenings saved filters"
  on public.happenings_saved_filters
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own happenings saved filters" on public.happenings_saved_filters;
create policy "Users can insert own happenings saved filters"
  on public.happenings_saved_filters
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own happenings saved filters" on public.happenings_saved_filters;
create policy "Users can update own happenings saved filters"
  on public.happenings_saved_filters
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own happenings saved filters" on public.happenings_saved_filters;
create policy "Users can delete own happenings saved filters"
  on public.happenings_saved_filters
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all happenings saved filters" on public.happenings_saved_filters;
create policy "Admins can read all happenings saved filters"
  on public.happenings_saved_filters
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create or replace function public.set_happenings_saved_filters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists happenings_saved_filters_updated_at on public.happenings_saved_filters;
create trigger happenings_saved_filters_updated_at
before update on public.happenings_saved_filters
for each row
execute function public.set_happenings_saved_filters_updated_at();

