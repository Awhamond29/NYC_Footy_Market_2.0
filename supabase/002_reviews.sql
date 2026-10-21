-- =====================================================================
-- NYC Footy Market: player reviews
-- Run once in Supabase → SQL Editor → New query → Run
-- (after schema.sql, which is already set up).
-- =====================================================================

create table public.reviews (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  rating      int  not null check (rating between 1 and 5),
  showed_up   boolean not null default true,
  comment     text not null default '' check (char_length(comment) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint no_self_review check (player_id <> reviewer_id),
  constraint one_review_per_pair unique (player_id, reviewer_id)
);
create index reviews_player_idx on public.reviews (player_id, created_at desc);

-- You can review someone only after a real exchange: a chat where
-- you've both sent at least one message, and neither of you blocked the other.
create function public.can_review(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and target <> auth.uid()
     and not public.is_blocked_between(auth.uid(), target)
     and exists (
       select 1 from public.conversations c
       where c.user_a = least(auth.uid(), target)
         and c.user_b = greatest(auth.uid(), target)
         and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = auth.uid())
         and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = target)
     );
$$;
revoke all on function public.can_review(uuid) from anon, public;
grant execute on function public.can_review(uuid) to authenticated;

alter table public.reviews enable row level security;

create policy "reviews are readable by signed-in users"
  on public.reviews for select to authenticated using (true);
create policy "eligible users write a review"
  on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.can_review(player_id));
create policy "reviewers edit their review"
  on public.reviews for update to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid() and public.can_review(player_id));
create policy "reviewers delete their review"
  on public.reviews for delete to authenticated using (reviewer_id = auth.uid());

-- Reviewers can't move a review to a different player or backdate it.
revoke update on public.reviews from authenticated;
grant update (rating, showed_up, comment, updated_at) on public.reviews to authenticated;

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

-- Rating summary per player, for cards and sorting.
create view public.review_stats with (security_invoker = true) as
  select player_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*)::int as review_count,
         (count(*) filter (where not showed_up))::int as no_shows
  from public.reviews
  group by player_id;

revoke all on public.review_stats from anon, public;
grant select on public.review_stats to authenticated;
