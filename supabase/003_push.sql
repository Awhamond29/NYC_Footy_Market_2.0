-- =====================================================================
-- NYC Footy Market: message notifications
-- Run once in Supabase → SQL Editor → New query → Run
-- (after schema.sql and 002_reviews.sql).
-- =====================================================================

-- One row per phone/browser that turned on notifications.
create table public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- People only ever see and manage their own devices.
create policy "users read their own devices"
  on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "users add their own devices"
  on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "users remove their own devices"
  on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Re-subscribing the same device moves it to whoever is signed in now
-- (e.g. two people sharing a phone), so it can't keep notifying the old account.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;
revoke all on function public.save_push_subscription(text, text, text) from anon, public;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- Marks each message once it has been notified, so it can't trigger twice.
-- Only the server (with the secret key) can set it; users can't.
alter table public.messages add column pushed_at timestamptz;
