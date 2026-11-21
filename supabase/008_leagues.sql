-- =====================================================================
-- NYC Footy Market: League sign-ups
-- League managers post their league (fee, format, details); teams browse,
-- message the manager, pay the entry fee on Venmo and leave reviews.
-- New leagues stay hidden until you approve them: Table Editor → leagues →
-- tick "approved" on the row.
-- Run once in Supabase → SQL Editor → New query → Run.
-- =====================================================================

create table public.leagues (
  id              uuid primary key default gen_random_uuid(),
  manager_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name            text not null check (char_length(trim(name)) between 2 and 80),
  photo_url       text check (char_length(photo_url) <= 500),
  format          text not null default '7v7' check (format in ('5v5', '6v6', '7v7', '8v8', '9v9', '11v11')),
  gender          text not null default 'Coed' check (gender in ('Coed', 'Men''s', 'Women''s', 'Open')),
  level           text not null default 'Recreational' check (level in ('Recreational', 'Intermediate', 'Competitive')),
  area            text not null default '' check (char_length(area) <= 100),
  game_day        text not null default '' check (char_length(game_day) <= 60),
  season_start    date,
  signup_deadline date,
  entry_fee       int  not null default 0 check (entry_fee between 0 and 20000),
  contact_name    text not null default '' check (char_length(contact_name) <= 60),
  contact         text not null default '' check (char_length(contact) <= 120),
  venmo           text not null default '' check (char_length(venmo) <= 40),
  signup_url      text not null default '' check (signup_url = '' or (signup_url ~* '^https?://' and char_length(signup_url) <= 300)),
  description     text not null default '' check (char_length(description) <= 3000),
  approved        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index leagues_manager_idx on public.leagues (manager_id);

alter table public.leagues enable row level security;

-- Everyone (guests too) sees approved leagues; managers also see their own pending ones.
create policy "approved leagues are public"
  on public.leagues for select to anon, authenticated
  using (approved or manager_id = auth.uid());

create policy "adults post leagues for approval"
  on public.leagues for insert to authenticated
  with check (
    manager_id = auth.uid()
    and not approved
    and exists (select 1 from public.profiles where id = auth.uid() and is_adult)
  );

create policy "managers edit their league"
  on public.leagues for update to authenticated
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());

create policy "managers delete their league"
  on public.leagues for delete to authenticated
  using (manager_id = auth.uid());

-- Managers can edit the details, but never approve themselves or hand the league to someone else.
revoke update on public.leagues from authenticated;
grant update (name, photo_url, format, gender, level, area, game_day, season_start, signup_deadline,
              entry_fee, contact_name, contact, venmo, signup_url, description, updated_at)
  on public.leagues to authenticated;
grant select on public.leagues to anon;

create trigger leagues_touch before update on public.leagues
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- League reviews: after you've messaged the manager and they replied.
-- ---------------------------------------------------------------------
create table public.league_reviews (
  id          bigint generated always as identity primary key,
  league_id   uuid not null references public.leagues (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  rating      int  not null check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint one_league_review_per_person unique (league_id, reviewer_id)
);
create index league_reviews_league_idx on public.league_reviews (league_id, created_at desc);

create function public.can_review_league(league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leagues l
    where l.id = league
      and l.approved
      and l.manager_id <> auth.uid()
      and public.can_review(l.manager_id)
  );
$$;
revoke all on function public.can_review_league(uuid) from anon, public;
grant execute on function public.can_review_league(uuid) to authenticated;

alter table public.league_reviews enable row level security;

create policy "league reviews are public"
  on public.league_reviews for select to anon, authenticated using (true);
create policy "eligible members review a league"
  on public.league_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.can_review_league(league_id));
create policy "reviewers edit their league review"
  on public.league_reviews for update to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid() and public.can_review_league(league_id));
create policy "reviewers delete their league review"
  on public.league_reviews for delete to authenticated using (reviewer_id = auth.uid());

revoke update on public.league_reviews from authenticated;
grant update (rating, comment, updated_at) on public.league_reviews to authenticated;
grant select on public.league_reviews to anon;

create trigger league_reviews_touch before update on public.league_reviews
  for each row execute function public.touch_updated_at();

create view public.league_review_stats with (security_invoker = true) as
  select league_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*)::int as review_count
  from public.league_reviews
  group by league_id;
grant select on public.league_review_stats to anon, authenticated;

alter publication supabase_realtime add table public.leagues;
