-- =====================================================================
-- NYC Footy Market: "Deal done" — logged bookings between two members
-- One person in a chat logs the deal (who's playing, position, price);
-- the other confirms it. Payment still happens directly (Venmo/cash).
-- Run once in Supabase → SQL Editor → New query → Run.
-- =====================================================================

create table public.deals (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_by      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  player_id       uuid not null references public.profiles (id) on delete cascade,  -- who plays
  payer_id        uuid not null references public.profiles (id) on delete cascade,  -- who pays
  position        text not null default 'OF' check (position in ('GK', 'OF')),
  amount          int  not null default 0 check (amount between 0 and 500),
  game_id         uuid references public.games (id) on delete set null,
  status          text not null default 'pending' check (status in ('pending', 'confirmed')),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  constraint different_people check (player_id <> payer_id)
);
create index deals_conversation_idx on public.deals (conversation_id, created_at desc);
-- At most one deal waiting for confirmation per chat.
create unique index deals_one_pending_per_chat on public.deals (conversation_id) where status = 'pending';

alter table public.deals enable row level security;

create policy "participants see their deals"
  on public.deals for select to authenticated
  using (public.is_participant(conversation_id));

-- Log a deal: you must be in the chat, the player and payer must be the two
-- people in it, nobody is blocked, and it isn't the support chat.
create policy "participants log deals"
  on public.deals for insert to authenticated
  with check (
    created_by = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_a, c.user_b)
        and least(player_id, payer_id) = c.user_a
        and greatest(player_id, payer_id) = c.user_b
        and not public.is_blocked_between(c.user_a, c.user_b)
        and public.support_user_id() is distinct from c.user_a
        and public.support_user_id() is distinct from c.user_b
    )
  );

-- The person who logged it can take it back while it's still unconfirmed.
create policy "creators cancel pending deals"
  on public.deals for delete to authenticated
  using (created_by = auth.uid() and status = 'pending');

revoke update on public.deals from authenticated;

-- The other person confirms (only they can).
create function public.confirm_deal(deal bigint)
returns void language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from public.deals where id = deal;
  if d.id is null or not public.is_participant(d.conversation_id) then
    raise exception 'Deal not found.';
  end if;
  if d.created_by = auth.uid() then
    raise exception 'The other person needs to confirm this deal.';
  end if;
  if d.status = 'confirmed' then
    return;
  end if;
  update public.deals set status = 'confirmed', confirmed_at = now() where id = deal;
end $$;
revoke all on function public.confirm_deal(bigint) from anon, public;
grant execute on function public.confirm_deal(bigint) to authenticated;

alter publication supabase_realtime add table public.deals;

-- For you (the admin), in the SQL Editor:
--   select status, count(*) as deals, sum(amount) as total_dollars,
--          round(avg(amount)) as avg_price,
--          count(*) filter (where position = 'GK') as keepers
--   from public.deals group by status;
