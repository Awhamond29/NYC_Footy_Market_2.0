-- =====================================================================
-- NYC Footy Market: guest browsing
-- Lets people who aren't signed in see listed players, open games and
-- reviews. Phone numbers, Venmo, chats and unlisted profiles stay private.
-- Run once in Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- Profiles guests can see: players listed in the market, plus anyone with an
-- upcoming game posted (so "posted by …" shows a name).
create policy "guests see listed players and game posters"
  on public.profiles for select to anon
  using (
    listed
    or exists (
      select 1 from public.games g
      where g.poster_id = profiles.id and g.kickoff > now() - interval '2 hours'
    )
  );

create policy "guests see games"
  on public.games for select to anon using (true);

create policy "guests see reviews"
  on public.reviews for select to anon using (true);

grant select on public.profiles, public.games, public.reviews to anon;
grant select on public.review_stats to anon;

-- Belt and braces: guests can never read private tables, even if a policy
-- is added by mistake later.
revoke all on public.contacts, public.public_contacts, public.conversations,
  public.messages, public.blocks, public.reports, public.push_subscriptions from anon;
