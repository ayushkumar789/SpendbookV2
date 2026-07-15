-- ═══════════════════════════════════════════════════════════
-- SpendBook V2.1 additions — run ONLY this if the original
-- schema.sql is already applied.
-- Adds: photo receipts, savings goals, split expenses.
-- ═══════════════════════════════════════════════════════════

-- Receipt attachment on transactions (stores the storage path)
alter table public.transactions add column if not exists receipt_url text;

-- Savings goals
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  saved_amount numeric default 0,
  color text not null,
  icon_emoji text not null,
  deadline date,
  created_at timestamptz default now()
);
alter table public.savings_goals enable row level security;
create policy "goals_owner_only" on public.savings_goals
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create index if not exists idx_goals_owner on public.savings_goals(owner_id);

-- Split expenses
create table if not exists public.splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete cascade,
  owner_id uuid references public.users(id) on delete cascade,
  person_name text not null,
  amount numeric not null,
  paid_back boolean default false,
  created_at timestamptz default now()
);
alter table public.splits enable row level security;
create policy "splits_owner_only" on public.splits
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create index if not exists idx_splits_txn on public.splits(transaction_id);
create index if not exists idx_splits_owner on public.splits(owner_id);

-- ───────────────────────────────────────────────
-- Storage: private "receipts" bucket
-- (Alternatively create it in Dashboard → Storage → New bucket,
--  name "receipts", Public OFF — then run just the policies.)
-- ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Only the owner can read/write files inside receipts/{their-user-id}/…
create policy "receipts_owner_read" on storage.objects
  for select using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_owner_update" on storage.objects
  for update using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
