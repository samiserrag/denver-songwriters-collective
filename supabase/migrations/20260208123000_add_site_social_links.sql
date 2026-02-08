-- Add configurable global social links to site settings.
alter table public.site_settings
add column if not exists social_links jsonb not null default '[]'::jsonb;

-- Seed existing singleton row with current production defaults if empty.
update public.site_settings
set social_links = '[
  {"label":"Instagram","url":"https://www.instagram.com/denver_songwriters_collective","platform":"instagram"},
  {"label":"Facebook","url":"https://www.facebook.com/groups/denversongwriterscollective","platform":"facebook"},
  {"label":"YouTube","url":"https://www.youtube.com/@DenverSongwritersCollective","platform":"youtube"}
]'::jsonb
where id = 'global'
  and (
    social_links is null
    or jsonb_typeof(social_links) <> 'array'
    or jsonb_array_length(social_links) = 0
  );

comment on column public.site_settings.social_links is
  'Global site social links shown in header/footer as an ordered array of {label,url,platform}.';
