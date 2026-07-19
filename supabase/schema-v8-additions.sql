-- ═══════════════════════════════════════════════════════════
-- SpendBook v8 additions — run AFTER schema.sql + v2…v7
-- Primary book: balance calculations only count transactions
-- from the one book the user marks as primary.
-- ═══════════════════════════════════════════════════════════

-- ————— is_primary on books —————

alter table public.books
  add column if not exists is_primary boolean default false;

-- Only one primary book per user at a time — enforced in application
-- logic (the app clears every primary flag before setting a new one),
-- not by a DB constraint, because partial unique indexes on nulls are
-- complex to maintain across the sharing policies.

create index if not exists idx_books_primary
  on public.books(owner_id) where is_primary = true;

-- ————— get_public_balance: now filtered by primary book —————
-- The function's return type changes numeric → jsonb, and Postgres
-- cannot alter a return type with `create or replace` — drop first.

drop function if exists public.get_public_balance(uuid);

create or replace function public.get_public_balance(p_group_id uuid)
returns jsonb
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
  v_owner_id uuid;
  v_primary_book_id uuid;
begin
  -- Check group is public and get owner
  select owner_id into v_owner_id
  from account_groups
  where id = p_group_id and show_on_profile = true;

  if v_owner_id is null then
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

  -- Get primary book for this user
  select id into v_primary_book_id
  from books
  where owner_id = v_owner_id and is_primary = true
  limit 1;

  -- If no primary book, return paused state with the raw snapshot
  if v_primary_book_id is null then
    return jsonb_build_object(
      'balance', v_snapshot_balance,
      'isPaused', true
    );
  end if;

  -- Get member payment method IDs
  select array_agg(payment_method_id)
  into v_member_ids
  from account_group_members
  where group_id = p_group_id;

  if v_member_ids is null then
    return jsonb_build_object(
      'balance', v_snapshot_balance,
      'isPaused', false
    );
  end if;

  -- Calculate adjustment from PRIMARY BOOK transactions only
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
  where book_id = v_primary_book_id
    and date > v_snapshot_date
    and (
      payment_method_id = any(v_member_ids) or
      transfer_to_payment_method_id = any(v_member_ids)
    );

  return jsonb_build_object(
    'balance', v_snapshot_balance + v_adjustment,
    'isPaused', false
  );
end;
$$;

grant execute on function public.get_public_balance(uuid) to anon, authenticated;
