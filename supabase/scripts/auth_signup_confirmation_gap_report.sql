-- Detect likely email/password signups that were auto-confirmed without
-- generating a confirmation email token.
--
-- Usage:
--   set -a; source web/.env.local; set +a
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -P pager=off -f supabase/scripts/auth_signup_confirmation_gap_report.sql

with candidate as (
  select
    u.id,
    u.email,
    u.created_at,
    u.confirmation_sent_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    (u.encrypted_password is not null) as has_password,
    exists (
      select 1
      from auth.identities i
      where i.user_id = u.id
        and i.provider in ('google', 'github', 'apple', 'azure', 'bitbucket', 'gitlab', 'facebook')
    ) as has_social_identity,
    (
      select count(*)
      from auth.one_time_tokens ott
      where ott.user_id = u.id
        and ott.token_type in ('confirmation_token', 'email_change_token_current', 'email_change_token_new')
    ) as confirmation_token_count
  from auth.users u
)
select
  count(*) as affected_count
from candidate
where has_password
  and not has_social_identity
  and confirmation_sent_at is null
  and confirmation_token_count = 0
  and email_confirmed_at is not null;

with candidate as (
  select
    u.id,
    u.email,
    u.created_at,
    u.confirmation_sent_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    (u.encrypted_password is not null) as has_password,
    exists (
      select 1
      from auth.identities i
      where i.user_id = u.id
        and i.provider in ('google', 'github', 'apple', 'azure', 'bitbucket', 'gitlab', 'facebook')
    ) as has_social_identity,
    (
      select count(*)
      from auth.one_time_tokens ott
      where ott.user_id = u.id
        and ott.token_type in ('confirmation_token', 'email_change_token_current', 'email_change_token_new')
    ) as confirmation_token_count
  from auth.users u
)
select
  email,
  created_at,
  confirmation_sent_at,
  email_confirmed_at,
  last_sign_in_at
from candidate
where has_password
  and not has_social_identity
  and confirmation_sent_at is null
  and confirmation_token_count = 0
  and email_confirmed_at is not null
order by created_at asc;
