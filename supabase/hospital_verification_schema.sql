-- BloodBridge Part 2: Hospital & Verification Schema
-- Extends Part 3 schema cleanly and with backward compatibility.
-- Preserves existing tables (profiles, blood_requests, conversations, messages).

-- 1. Extend profiles with role and hospital affiliation
alter table public.profiles
  add column if not exists role text not null default 'donor' check (role in ('donor', 'attender', 'hospital')),
  add column if not exists hospital_name text,
  add column if not exists phone text;

-- 2. Extend blood_requests with closure metadata
alter table public.blood_requests
  add column if not exists closed_at timestamptz,
  add column if not exists closure_reason text;

-- 3. Create donor_verifications table for Part 2 Hospital Verification
create table if not exists public.donor_verifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  hospital_id uuid references public.profiles(id) on delete set null,
  arrival_status text not null default 'pending' check (arrival_status in ('pending', 'arrived')),
  arrived_at timestamptz,
  outcome_status text check (outcome_status in ('DONATED', 'MEDICALLY_DEFERRED', 'NO_SHOW', 'CANCELLED')),
  deferral_reason text,
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, donor_id)
);

-- Indexes for optimal queries
create index if not exists donor_verifications_req_idx on public.donor_verifications(request_id);
create index if not exists donor_verifications_donor_idx on public.donor_verifications(donor_id);
create index if not exists donor_verifications_outcome_idx on public.donor_verifications(outcome_status);
create index if not exists blood_requests_hospital_idx on public.blood_requests(hospital, status);

-- 4. Helper functions for Hospital Authorization
create or replace function public.is_hospital_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'hospital'
  );
$$;

create or replace function public.is_authorized_hospital_for_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.blood_requests r on r.id = p_request_id
    where p.id = auth.uid()
      and p.role = 'hospital'
      and (p.hospital_name = r.hospital or p.hospital_name = 'ALL' or p.hospital_name is null)
  );
$$;

-- 5. Atomic RPC: Confirm Donor Arrival
create or replace function public.confirm_donor_arrival(
  p_request_id uuid,
  p_donor_id uuid
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_req public.blood_requests;
  v_verif public.donor_verifications;
  v_caller public.profiles;
begin
  -- Authorization check: Caller must be authenticated hospital
  select * into v_caller from public.profiles where id = auth.uid();
  if v_caller is null or v_caller.role <> 'hospital' then
    raise exception 'Unauthorized: Only hospital staff can confirm donor arrival';
  end if;

  -- Check blood request
  select * into v_req from public.blood_requests where id = p_request_id;
  if not found then
    raise exception 'Blood request not found';
  end if;

  if v_req.status = 'cancelled' then
    raise exception 'Cannot confirm arrival for a cancelled request';
  end if;

  -- Check caller hospital matches request hospital (unless ALL)
  if v_caller.hospital_name is not null and v_caller.hospital_name <> 'ALL' and v_caller.hospital_name <> v_req.hospital then
    raise exception 'Unauthorized: Hospital mismatch for this blood request';
  end if;

  -- Check if verification record already exists
  select * into v_verif from public.donor_verifications
  where request_id = p_request_id and donor_id = p_donor_id;

  if found then
    if v_verif.arrival_status = 'arrived' then
      -- Already confirmed - return current record idempotently
      return row_to_json(v_verif);
    end if;

    if v_verif.outcome_status in ('NO_SHOW', 'CANCELLED') then
      raise exception 'Cannot confirm arrival for a donor already marked %', v_verif.outcome_status;
    end if;

    update public.donor_verifications
    set arrival_status = 'arrived',
        arrived_at = coalesce(arrived_at, now()),
        hospital_id = auth.uid(),
        updated_at = now()
    where id = v_verif.id
    returning * into v_verif;
  else
    insert into public.donor_verifications (
      request_id, donor_id, hospital_id, arrival_status, arrived_at, updated_at
    ) values (
      p_request_id, p_donor_id, auth.uid(), 'arrived', now(), now()
    )
    returning * into v_verif;
  end if;

  return row_to_json(v_verif);
end $$;

-- 6. Atomic RPC: Verify Donation Outcome
create or replace function public.verify_donation_outcome(
  p_request_id uuid,
  p_donor_id uuid,
  p_outcome text,
  p_reason text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_req public.blood_requests;
  v_verif public.donor_verifications;
  v_caller public.profiles;
  v_donated_count int;
begin
  -- Validate outcome status
  if p_outcome not in ('DONATED', 'MEDICALLY_DEFERRED', 'NO_SHOW', 'CANCELLED') then
    raise exception 'Invalid outcome status. Allowed: DONATED, MEDICALLY_DEFERRED, NO_SHOW, CANCELLED';
  end if;

  -- Authorization check: Caller must be authenticated hospital
  select * into v_caller from public.profiles where id = auth.uid();
  if v_caller is null or v_caller.role <> 'hospital' then
    raise exception 'Unauthorized: Only hospital staff can verify donation outcomes';
  end if;

  -- Check blood request
  select * into v_req from public.blood_requests where id = p_request_id;
  if not found then
    raise exception 'Blood request not found';
  end if;

  if v_req.status = 'cancelled' then
    raise exception 'Cannot verify outcome for a cancelled blood request';
  end if;

  if v_req.status = 'fulfilled' and p_outcome <> 'DONATED' then
    raise exception 'Cannot record non-donated outcome for an already fulfilled request';
  end if;

  -- Check caller hospital matches request hospital
  if v_caller.hospital_name is not null and v_caller.hospital_name <> 'ALL' and v_caller.hospital_name <> v_req.hospital then
    raise exception 'Unauthorized: Hospital mismatch for this blood request';
  end if;

  -- Check existing verification record
  select * into v_verif from public.donor_verifications
  where request_id = p_request_id and donor_id = p_donor_id;

  if found then
    -- Rule: Prevent marking a donor as no-show after confirmed arrival or donation
    if p_outcome = 'NO_SHOW' and (v_verif.arrival_status = 'arrived' or v_verif.outcome_status = 'DONATED') then
      raise exception 'Cannot mark donor as no-show after confirmed arrival or donation';
    end if;

    -- If already has the same outcome, return idempotently
    if v_verif.outcome_status = p_outcome then
      return row_to_json(v_verif);
    end if;

    -- If already donated, don't allow changing to CANCELLED or NO_SHOW
    if v_verif.outcome_status = 'DONATED' and p_outcome in ('NO_SHOW', 'CANCELLED') then
      raise exception 'Cannot alter outcome to % once donation has been completed', p_outcome;
    end if;

    update public.donor_verifications
    set outcome_status = p_outcome,
        deferral_reason = case when p_outcome = 'MEDICALLY_DEFERRED' then p_reason else null end,
        arrival_status = case when p_outcome = 'DONATED' then 'arrived' else arrival_status end,
        arrived_at = case when p_outcome = 'DONATED' and arrived_at is null then now() else arrived_at end,
        hospital_id = auth.uid(),
        verified_at = now(),
        updated_at = now()
    where id = v_verif.id
    returning * into v_verif;
  else
    if p_outcome = 'NO_SHOW' then
      -- No show without prior arrival is valid
      insert into public.donor_verifications (
        request_id, donor_id, hospital_id, arrival_status, outcome_status, deferral_reason, verified_at, updated_at
      ) values (
        p_request_id, p_donor_id, auth.uid(), 'pending', p_outcome, null, now(), now()
      )
      returning * into v_verif;
    elsif p_outcome = 'DONATED' then
      -- Donated implies arrival
      insert into public.donor_verifications (
        request_id, donor_id, hospital_id, arrival_status, arrived_at, outcome_status, verified_at, updated_at
      ) values (
        p_request_id, p_donor_id, auth.uid(), 'arrived', now(), p_outcome, now(), now()
      )
      returning * into v_verif;
    else
      insert into public.donor_verifications (
        request_id, donor_id, hospital_id, arrival_status, outcome_status, deferral_reason, verified_at, updated_at
      ) values (
        p_request_id, p_donor_id, auth.uid(), 'pending', p_outcome, p_reason, now(), now()
      )
      returning * into v_verif;
    end if;
  end if;

  -- Auto-check if blood request is now fulfilled
  select count(*) into v_donated_count
  from public.donor_verifications
  where request_id = p_request_id and outcome_status = 'DONATED';

  if v_donated_count >= v_req.units and v_req.status = 'open' then
    update public.blood_requests
    set status = 'fulfilled',
        closed_at = now(),
        closure_reason = 'All required units fulfilled by verified donations'
    where id = p_request_id;
  end if;

  return row_to_json(v_verif);
end $$;

-- 7. Atomic RPC: Close Blood Request
create or replace function public.close_blood_request(
  p_request_id uuid,
  p_closure_reason text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_req public.blood_requests;
  v_caller public.profiles;
  v_donated_count int;
  v_new_status text;
begin
  -- Authorization check
  select * into v_caller from public.profiles where id = auth.uid();
  if v_caller is null or v_caller.role <> 'hospital' then
    raise exception 'Unauthorized: Only hospital staff can close blood requests';
  end if;

  select * into v_req from public.blood_requests where id = p_request_id;
  if not found then
    raise exception 'Blood request not found';
  end if;

  if v_req.status in ('fulfilled', 'cancelled') then
    raise exception 'Request is already closed with status %', v_req.status;
  end if;

  -- Check caller hospital matches
  if v_caller.hospital_name is not null and v_caller.hospital_name <> 'ALL' and v_caller.hospital_name <> v_req.hospital then
    raise exception 'Unauthorized: Hospital mismatch for this blood request';
  end if;

  -- Calculate verified donations
  select count(*) into v_donated_count
  from public.donor_verifications
  where request_id = p_request_id and outcome_status = 'DONATED';

  if v_donated_count >= v_req.units then
    v_new_status := 'fulfilled';
  else
    -- Early closure requires explicit reason
    if p_closure_reason is null or length(btrim(p_closure_reason)) < 3 then
      raise exception 'A valid closure reason is required when closing an unfulfilled request (Verified: % of % required)', v_donated_count, v_req.units;
    end if;
    v_new_status := 'cancelled';
  end if;

  update public.blood_requests
  set status = v_new_status,
      closed_at = now(),
      closure_reason = coalesce(p_closure_reason, 'Fulfilled with verified donations')
  where id = p_request_id
  returning * into v_req;

  return row_to_json(v_req);
end $$;

-- 8. Row Level Security on donor_verifications
alter table public.donor_verifications enable row level security;

-- Authenticated hospital users can read all verifications for their hospital
create policy "hospital staff read verifications" on public.donor_verifications
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.blood_requests r on r.id = donor_verifications.request_id
      where p.id = auth.uid()
        and p.role = 'hospital'
        and (p.hospital_name = r.hospital or p.hospital_name = 'ALL' or p.hospital_name is null)
    )
  );

-- Donors can read their own verification records
create policy "donors read own verifications" on public.donor_verifications
  for select to authenticated
  using (donor_id = auth.uid());

-- Requesters can read verifications for their requests
create policy "requesters read their request verifications" on public.donor_verifications
  for select to authenticated
  using (
    exists (
      select 1 from public.blood_requests r
      where r.id = donor_verifications.request_id and r.requester_id = auth.uid()
    )
  );

-- Only authorized hospital staff can insert or update verifications
create policy "hospital staff modify verifications" on public.donor_verifications
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.blood_requests r on r.id = donor_verifications.request_id
      where p.id = auth.uid()
        and p.role = 'hospital'
        and (p.hospital_name = r.hospital or p.hospital_name = 'ALL' or p.hospital_name is null)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      join public.blood_requests r on r.id = donor_verifications.request_id
      where p.id = auth.uid()
        and p.role = 'hospital'
        and (p.hospital_name = r.hospital or p.hospital_name = 'ALL' or p.hospital_name is null)
    )
  );

-- Grant execute permissions to authenticated users
grant execute on function public.confirm_donor_arrival(uuid, uuid) to authenticated;
grant execute on function public.verify_donation_outcome(uuid, uuid, text, text) to authenticated;
grant execute on function public.close_blood_request(uuid, text) to authenticated;
grant execute on function public.is_hospital_user() to authenticated;
grant execute on function public.is_authorized_hospital_for_request(uuid) to authenticated;

-- Add donor_verifications to realtime
alter publication supabase_realtime add table public.donor_verifications;
