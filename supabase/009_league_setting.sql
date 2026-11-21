-- =====================================================================
-- NYC Footy Market: indoor / outdoor for leagues
-- Run once in Supabase → SQL Editor (after 008_leagues.sql).
-- =====================================================================
alter table public.leagues
  add column setting text not null default 'Outdoor' check (setting in ('Outdoor', 'Indoor', 'Both'));
grant update (setting) on public.leagues to authenticated;
