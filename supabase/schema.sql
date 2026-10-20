-- =====================================================================
-- NYC Footy Market — database schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- ---------- Profiles (public info shown on player cards) ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 60),
  position    text not null default 'OF' check (position in ('GK', 'OF')),
  role        text not null default '' check (char_length(role) <= 40),
  area        text not null default '' check (char_length(area) <= 60),
  college     text not null default '' check (char_length(college) <= 80),
  experience  text not null default '' check (char_length(experience) <= 300),
  bio         text not null default '' check (char_length(bio) <= 400),
  days        text[] not null default '{}',
  price       int  not null default 20 check (price between 0 and 500),
  listed      boolean not null default false,
  is_adult    boolean not null default false,
  photo_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint listed_needs_name_and_age check (not listed or (is_adult and char_length(trim(name)) > 0))
);

alter table public.profiles enable row level security;

-- Any signed-in user can see profiles (needed for cards and chat headers).
-- Nothing private lives here: phone and Venmo are in `contacts` below.
create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);
create policy "users edit their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Contacts (private; exposed only through the view) ----------
create table public.contacts (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  phone       text not null default '' check (char_length(phone) <= 30),
  venmo       text not null default '' check (char_length(venmo) <= 40),
  show_phone  boolean not null default false,
  show_venmo  boolean not null default false
);

alter table public.contacts enable row level security;

create policy "users read their own contacts"
  on public.contacts for select to authenticated using (user_id = auth.uid());
create policy "users update their own contacts"
  on public.contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- What other people see: a number or handle only when its owner switched it on.
-- (Runs with the owner's rights on purpose, so it can read past the table's
-- row rules while still hiding every value that isn't public.)
create view public.public_contacts as
  select user_id,
         case when show_phone and phone <> '' then phone end as phone,
         case when show_venmo and venmo <> '' then venmo end as venmo
  from public.contacts;

revoke all on public.public_contacts from anon, public;
grant select on public.public_contacts to authenticated;

-- Create a blank profile + contacts row for every new sign-up,
-- pre-filling name and photo from Google when available.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, photo_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 60),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.contacts (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Blocks and reports ----------
create table public.blocks (
  blocker    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  blocked    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.blocks enable row level security;
create policy "users see their own blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "users add blocks" on public.blocks for insert to authenticated with check (blocker = auth.uid() and blocked <> auth.uid());
create policy "users remove blocks" on public.blocks for delete to authenticated using (blocker = auth.uid());

create table public.reports (
  id         bigint generated always as identity primary key,
  reporter   uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reported   uuid not null references public.profiles (id) on delete cascade,
  reason     text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
-- Users can file reports but not read them. Review them in Supabase → Table editor.
create policy "users file reports" on public.reports for insert to authenticated with check (reporter = auth.uid());

create function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- ---------- Games (teams short on players) ----------
create table public.games (
  id         uuid primary key default gen_random_uuid(),
  poster_id  uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title      text not null check (char_length(title) between 1 and 80),
  field      text not null check (char_length(field) between 1 and 100),
  kickoff    timestamptz not null,
  need_gk    int not null default 0 check (need_gk between 0 and 5),
  need_of    int not null default 0 check (need_of between 0 and 11),
  level      text not null default 'Intermediate' check (level in ('Casual', 'Rec', 'Intermediate', 'Competitive')),
  note       text not null default '' check (char_length(note) <= 400),
  created_at timestamptz not null default now(),
  constraint needs_someone check (need_gk + need_of > 0)
);
create index games_kickoff_idx on public.games (kickoff);

alter table public.games enable row level security;
create policy "games are readable by signed-in users"
  on public.games for select to authenticated using (true);
create policy "adults post games for the future"
  on public.games for insert to authenticated
  with check (
    poster_id = auth.uid()
    and kickoff > now()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_adult)
  );
create policy "posters edit their games"
  on public.games for update to authenticated
  using (poster_id = auth.uid()) with check (poster_id = auth.uid());
create policy "posters delete their games"
  on public.games for delete to authenticated using (poster_id = auth.uid());

-- ---------- Conversations and messages (DMs) ----------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles (id) on delete cascade,
  user_b          uuid not null references public.profiles (id) on delete cascade,
  game_id         uuid references public.games (id) on delete set null,
  last_message    text not null default '',
  last_sender     uuid,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint ordered_pair check (user_a < user_b),
  constraint one_chat_per_pair unique (user_a, user_b)
);

alter table public.conversations enable row level security;
create policy "participants read their conversations"
  on public.conversations for select to authenticated
  using (auth.uid() in (user_a, user_b));
-- No insert/update policies: conversations are created by start_conversation()
-- and updated by the message trigger below.

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body            text not null check (char_length(trim(body)) between 1 and 2000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index messages_convo_idx on public.messages (conversation_id, created_at);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;

alter table public.messages enable row level security;

create function public.is_participant(convo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = convo and auth.uid() in (c.user_a, c.user_b)
  );
$$;

create policy "participants read messages"
  on public.messages for select to authenticated
  using (public.is_participant(conversation_id));

create policy "participants send messages unless blocked"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_participant(conversation_id)
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.user_a, c.user_b)
    )
  );

-- Recipients may only mark messages read; nothing else about a message can change.
create policy "recipients mark messages read"
  on public.messages for update to authenticated
  using (public.is_participant(conversation_id) and sender_id <> auth.uid())
  with check (public.is_participant(conversation_id) and sender_id <> auth.uid());
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

create function public.after_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message = left(new.body, 140),
         last_sender = new.sender_id,
         last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.after_message_insert();

-- Opens (or reuses) the one chat between the caller and another user.
create function public.start_conversation(other uuid, game uuid default null)
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
  if not exists (select 1 from public.profiles where id = me and is_adult) then
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

revoke all on function public.start_conversation(uuid, uuid) from anon, public;
grant execute on function public.start_conversation(uuid, uuid) to authenticated;

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.messages, public.games;

-- ---------- Profile photos ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "users upload their own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users replace their own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
