-- Red Drop chat schema. Run once in Supabase Dashboard > SQL Editor.
-- Chats exist only for an accepted blood request and close when the request is fulfilled.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  blood_group text check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  created_at timestamptz not null default now()
);

create table public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blood_group text not null check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  units int not null default 1 check (units between 1 and 10),
  hospital text not null,
  needed_by timestamptz,
  note text,
  status text not null default 'open' check (status in ('open','fulfilled','cancelled')),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (request_id, donor_id),
  check (requester_id <> donor_id)
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, id);

-- Create a profile automatically when someone signs up (Google OAuth etc.)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by row-level security
create function public.is_participant(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations where id = c and auth.uid() in (requester_id, donor_id));
$$;
create function public.chat_open(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations v join blood_requests r on r.id = v.request_id
                 where v.id = c and r.status = 'open');
$$;

-- A donor accepts a request: creates (or returns) the conversation. Call from any screen:
--   const { data: conversationId } = await supabase.rpc('accept_request', { p_request_id })
create function public.accept_request(p_request_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.blood_requests; cid uuid;
begin
  select * into r from public.blood_requests where id = p_request_id and status = 'open';
  if not found then raise exception 'This request is no longer open'; end if;
  if r.requester_id = auth.uid() then raise exception 'You cannot accept your own request'; end if;
  insert into public.conversations (request_id, requester_id, donor_id)
  values (r.id, r.requester_id, auth.uid()) on conflict (request_id, donor_id) do nothing;
  select id into cid from public.conversations where request_id = r.id and donor_id = auth.uid();
  return cid;
end $$;

revoke execute on function public.accept_request(uuid), public.is_participant(uuid), public.chat_open(uuid) from public, anon;
grant execute on function public.accept_request(uuid), public.is_participant(uuid), public.chat_open(uuid) to authenticated;

-- Row-level security
alter table public.profiles enable row level security;
alter table public.blood_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "requests readable by signed-in users" on public.blood_requests for select to authenticated using (true);
create policy "create own request" on public.blood_requests for insert to authenticated with check (requester_id = auth.uid());
create policy "update own request" on public.blood_requests for update to authenticated
  using (requester_id = auth.uid()) with check (requester_id = auth.uid());

create policy "participants read conversation" on public.conversations for select to authenticated
  using (auth.uid() in (requester_id, donor_id));   -- inserts only via accept_request()

create policy "participants read messages" on public.messages for select to authenticated
  using (public.is_participant(conversation_id));
create policy "participants send messages while request is open" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id) and public.chat_open(conversation_id));

-- Realtime (postgres_changes respects the policies above)
alter publication supabase_realtime add table public.messages, public.conversations, public.blood_requests;

-- Test data: after two people have signed in, find their ids in Authentication > Users, then:
-- insert into public.blood_requests (requester_id, blood_group, units, hospital, needed_by)
-- values ('<REQUESTER_UUID>', 'O-', 2, 'Manipal Hospital, Old Airport Rd', now() + interval '6 hours');
