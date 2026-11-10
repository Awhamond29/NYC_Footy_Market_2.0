-- =====================================================================
-- NYC Footy Market: entrance fee for posted games
-- What each player who joins pays to play (0 = free).
-- Run once in Supabase → SQL Editor → New query → Run.
-- =====================================================================

alter table public.games
  add column entry_fee int not null default 0 check (entry_fee between 0 and 200);
