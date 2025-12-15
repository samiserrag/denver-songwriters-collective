-- Site Settings table for global configuration (theme, font presets)
-- Single row table with id='global' pattern

create table if not exists public.site_settings (
  id text primary key default 'global',
  theme_preset text not null default '',
  font_preset text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Enable RLS
alter table public.site_settings enable row level security;

-- Public read policy (all visitors can read site settings)
create policy "site_settings_read_all"
on public.site_settings
for select
to anon, authenticated
using (true);

-- No UPDATE/INSERT/DELETE policies - these operations happen via service role
-- This ensures only admin code paths can modify settings

-- Insert the global singleton row
insert into public.site_settings (id, theme_preset, font_preset)
values ('global', '', '')
on conflict (id) do nothing;

-- Add comment for documentation
comment on table public.site_settings is 'Global site configuration. Single row with id=global. Theme/font presets apply to all visitors. Admin-only write via service role.';
