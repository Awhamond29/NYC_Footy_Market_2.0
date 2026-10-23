-- =====================================================================
-- NYC Footy Market: official support account + welcome message
-- Run once in Supabase → SQL Editor → New query → Run
-- (after schema.sql, 002, 003 and 004).
--
-- Then, after you've created the support account on the site, run:
--   select public.set_support_account('the-support-email@example.com');
-- and optionally, to welcome everyone who signed up before today:
--   select public.welcome_existing_users();
-- =====================================================================

-- Which account is the official one (at most one row).
create table public.support_account (
  only_one boolean primary key default true check (only_one),
  user_id  uuid not null references public.profiles (id) on delete cascade
);
alter table public.support_account enable row level security;
create policy "everyone can see which account is official"
  on public.support_account for select to anon, authenticated using (true);
-- No insert/update/delete policies: only set_support_account() (run in the SQL Editor) can change it.
grant select on public.support_account to anon, authenticated;

create function public.support_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.support_account where only_one;
$$;

-- The welcome chat every new member gets.
create function public.send_welcome(new_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  support uuid := public.support_user_id();
  cid uuid;
begin
  if support is null or new_user = support then
    return;
  end if;
  insert into public.conversations (user_a, user_b)
  values (least(support, new_user), greatest(support, new_user))
  on conflict (user_a, user_b) do nothing
  returning id into cid;
  if cid is null then
    return; -- already has a chat with support
  end if;
  insert into public.messages (conversation_id, sender_id, body) values (cid, support,
    'Welcome to NYC Footy Market! A few things to get you started:' || chr(10) || chr(10) ||
    '1. Get the app: add it to your home screen in a few taps. Guide: nycfootymarket.com/install' || chr(10) ||
    '2. Turn on notifications on your profile so you never miss a team messaging you.' || chr(10) ||
    '3. Want to get picked up for games? Finish your profile and switch on "List me in the market".' || chr(10) || chr(10) ||
    'Questions, a problem, or someone to report? Reply here anytime. This chat goes straight to the NYC Footy Market team.');
end $$;
revoke all on function public.send_welcome(uuid) from anon, authenticated, public;

-- New sign-ups: same as before, plus the welcome chat.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, photo_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 60),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.contacts (user_id) values (new.id);
  begin
    perform public.send_welcome(new.id);
  exception when others then
    null; -- never block a sign-up because of the welcome message
  end;
  return new;
end $$;

-- Run once in the SQL Editor after creating the support account on the site.
create function public.set_support_account(support_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(support_email));
  if uid is null then
    raise exception 'No account with email %. Sign up on the site with that email first.', support_email;
  end if;
  insert into public.support_account (only_one, user_id) values (true, uid)
  on conflict (only_one) do update set user_id = excluded.user_id;
  update public.profiles set listed = false, is_adult = true where id = uid;
  return 'Support account set: ' || support_email;
end $$;
revoke all on function public.set_support_account(text) from anon, authenticated, public;

-- Optional: send the welcome chat to everyone who joined before support existed.
create function public.welcome_existing_users()
returns text language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  p record;
begin
  if public.support_user_id() is null then
    raise exception 'Set the support account first with set_support_account(email).';
  end if;
  for p in select id from public.profiles where id <> public.support_user_id() loop
    perform public.send_welcome(p.id);
    n := n + 1;
  end loop;
  return 'Checked ' || n || ' members (anyone who already had a chat with support was skipped).';
end $$;
revoke all on function public.welcome_existing_users() from anon, authenticated, public;

-- Anyone signed in can message support, even before finishing their profile.
create or replace function public.start_conversation(other uuid, game uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  if other = me then
    raise exception 'You can''t message yourself.';
  end if;
  if other is distinct from public.support_user_id()
     and not exists (select 1 from public.profiles where id = me and is_adult) then
    raise exception 'Confirm you''re 18 or older on your profile first.';
  end if;
  if not exists (select 1 from public.profiles where id = other) then
    raise exception 'That player no longer exists.';
  end if;
  if public.is_blocked_between(me, other) then
    raise exception 'You can''t message this person.';
  end if;

  insert into public.conversations (user_a, user_b, game_id)
  values (least(me, other), greatest(me, other), game)
  on conflict (user_a, user_b)
    do update set game_id = coalesce(excluded.game_id, public.conversations.game_id)
  returning id into cid;

  return cid;
end $$;

-- The support account can't be reviewed.
create or replace function public.can_review(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and target <> auth.uid()
     and target is distinct from public.support_user_id()
     and not public.is_blocked_between(auth.uid(), target)
     and exists (
       select 1 from public.conversations c
       where c.user_a = least(auth.uid(), target)
         and c.user_b = greatest(auth.uid(), target)
         and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = auth.uid())
         and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = target)
     );
$$;
