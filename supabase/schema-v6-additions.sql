-- ═══════════════════════════════════════════════════════════
-- SpendBook v6 additions — run AFTER schema.sql + v2…v5
-- Account groups with live balances (+ public profile balances),
-- and two small read policies that complete the Details-level
-- transaction drill-down (splits + receipt images).
-- ═══════════════════════════════════════════════════════════

-- ————— Account groups (payment methods grouped into one bank account) —————

create table if not exists public.account_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  bank_key text not null,
  bank_name text not null,
  color text not null,
  show_on_profile boolean default false,
  created_at timestamptz default now()
);

alter table public.account_groups enable row level security;

create policy "owner only" on public.account_groups
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Public profiles list groups the owner opted in to sharing.
create policy "public profile read" on public.account_groups
  for select using (show_on_profile = true);

create index if not exists idx_account_groups_owner on public.account_groups(owner_id);

-- ————— Group members (a payment method belongs to at most one group) —————

create table if not exists public.account_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.account_groups(id) on delete cascade,
  payment_method_id uuid references public.payment_methods(id) on delete cascade,
  owner_id uuid references public.users(id) on delete cascade,
  unique(group_id, payment_method_id)
);

alter table public.account_group_members enable row level security;

create policy "owner only" on public.account_group_members
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Allow public read of group members for public groups
-- (only ids — the public page never renders payment method details).
create policy "public member read" on public.account_group_members
  for select using (
    exists (
      select 1 from public.account_groups
      where id = account_group_members.group_id
      and show_on_profile = true
    )
  );

create index if not exists idx_agm_group on public.account_group_members(group_id);
create index if not exists idx_agm_owner on public.account_group_members(owner_id);

-- ————— Balance snapshots (user-entered baselines; history is kept) —————

create table if not exists public.account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.account_groups(id) on delete cascade,
  owner_id uuid references public.users(id) on delete cascade,
  balance numeric not null,
  snapshot_date timestamptz not null default now(),
  note text,
  created_at timestamptz default now()
);

alter table public.account_balance_snapshots enable row level security;

create policy "owner only" on public.account_balance_snapshots
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Allow public read of snapshots for public groups (used for the
-- "Updated 2 hours ago" stamp on the public profile).
create policy "public snapshot read" on public.account_balance_snapshots
  for select using (
    exists (
      select 1 from public.account_groups
      where id = account_balance_snapshots.group_id
      and show_on_profile = true
    )
  );

create index if not exists idx_snapshots_group on public.account_balance_snapshots(group_id, snapshot_date desc);

-- ————— Public live balance —————
-- Anonymous profile visitors must never read raw transactions, so the
-- balance math runs in a SECURITY DEFINER function that returns one number.

create or replace function public.get_public_balance(p_group_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_snapshot_balance numeric;
  v_snapshot_date timestamptz;
  v_adjustment numeric := 0;
  v_member_ids uuid[];
begin
  -- Check group is public
  if not exists (
    select 1 from account_groups
    where id = p_group_id and show_on_profile = true
  ) then
    return null;
  end if;

  -- Get latest snapshot
  select balance, snapshot_date
  into v_snapshot_balance, v_snapshot_date
  from account_balance_snapshots
  where group_id = p_group_id
  order by snapshot_date desc
  limit 1;

  if v_snapshot_balance is null then
    return null;
  end if;

  -- Get member payment method IDs
  select array_agg(payment_method_id)
  into v_member_ids
  from account_group_members
  where group_id = p_group_id;

  if v_member_ids is null then
    return v_snapshot_balance;
  end if;

  -- Calculate adjustment from transactions after snapshot
  select coalesce(sum(
    case
      when type = 'in' and payment_method_id = any(v_member_ids)
        then amount
      when type = 'out' and payment_method_id = any(v_member_ids)
        then -amount
      when type = 'transfer' and payment_method_id = any(v_member_ids)
        then -amount
      when type = 'transfer' and transfer_to_payment_method_id = any(v_member_ids)
        then amount
      else 0
    end
  ), 0)
  into v_adjustment
  from transactions
  where date > v_snapshot_date
  and (
    payment_method_id = any(v_member_ids) or
    transfer_to_payment_method_id = any(v_member_ids)
  );

  return v_snapshot_balance + v_adjustment;
end;
$$;

grant execute on function public.get_public_balance(uuid) to anon, authenticated;

-- ————— Details-level drill-down: splits + receipt images —————
-- The v5 Details/Edit share levels show the complete transaction. These two
-- policies let visitors of such books read split rows and the receipt file.

create policy "splits_shared_details_read" on public.splits
  for select using (
    exists (
      select 1
      from public.transactions t
      join public.books b on b.id = t.book_id
      where t.id = splits.transaction_id
        and b.is_shared = true
        and (
          (b.share_details_id is not null and coalesce(b.share_details_active, true))
          or (b.share_edit_id is not null and coalesce(b.share_edit_active, true))
        )
    )
  );

-- Receipt paths are stored verbatim in transactions.receipt_url, so the
-- object name can be matched straight against it.
create policy "receipts_shared_details_read" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and exists (
      select 1
      from public.transactions t
      join public.books b on b.id = t.book_id
      where t.receipt_url = storage.objects.name
        and b.is_shared = true
        and (
          (b.share_details_id is not null and coalesce(b.share_details_active, true))
          or (b.share_edit_id is not null and coalesce(b.share_edit_active, true))
        )
    )
  );
