-- ═══════════════════════════════════════════════════════════
-- SpendBook V2 — full schema + Row Level Security
-- Run this once in Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- Users
create table if not exists public.users (
  id uuid references auth.users primary key,
  display_name text,
  email text,
  photo_url text,
  created_at timestamptz default now()
);

-- Payment Methods
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  bank_key text not null,
  bank_name text not null,
  bank_is_custom boolean default false,
  payment_type text not null, -- 'upi' | 'debit' | 'credit' | 'netbanking'
  upi_app text,
  upi_app_is_custom boolean default false,
  upi_app_name text,
  last_four_digits text not null,
  created_at timestamptz default now()
);

-- Books
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  description text,
  color_tag text not null,
  icon_emoji text not null,
  monthly_budget numeric,
  is_shared boolean default false,
  share_id uuid,
  created_at timestamptz default now()
);

-- Transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  owner_id uuid references public.users(id) on delete cascade,
  type text not null, -- 'in' | 'out'
  amount numeric not null,
  category text not null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  note text,
  date date not null,
  is_recurring boolean default false,
  recurrence_interval text, -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  next_recurrence_date date,
  created_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_books_owner on public.books(owner_id);
create index if not exists idx_books_share on public.books(share_id) where is_shared = true;
create index if not exists idx_tx_book on public.transactions(book_id, date desc);
create index if not exists idx_tx_owner on public.transactions(owner_id);
create index if not exists idx_tx_recurring on public.transactions(owner_id, next_recurrence_date) where is_recurring = true;
create index if not exists idx_pm_owner on public.payment_methods(owner_id);

-- ───────────────────────────────────────────────
-- Row Level Security
-- ───────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.payment_methods enable row level security;
alter table public.books enable row level security;
alter table public.transactions enable row level security;

-- users: a person can read/write only their own row
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Shared views need the owner's display name only for shared books
create policy "users_select_shared_owner" on public.users
  for select using (
    exists (
      select 1 from public.books b
      where b.owner_id = users.id and b.is_shared = true
    )
  );

-- payment_methods: owner only
create policy "pm_all_own" on public.payment_methods
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- books: owner full access; anyone (incl. anonymous) can read shared books
create policy "books_all_own" on public.books
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "books_select_shared" on public.books
  for select using (is_shared = true);

-- transactions: owner full access; anyone can read rows of a shared book
create policy "tx_all_own" on public.transactions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "tx_select_shared" on public.transactions
  for select using (
    exists (
      select 1 from public.books b
      where b.id = transactions.book_id and b.is_shared = true
    )
  );

-- ───────────────────────────────────────────────
-- Realtime (for live shared views)
-- ───────────────────────────────────────────────
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.books;

-- ═══════════════════════════════════════════════════════════
-- V2.1 additions (receipts, goals, splits) — see schema-v2-additions.sql
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

-- ═══════════════════════════════════════════════════════════
-- V3 additions (wallet vault, profile links) — see schema-v3-additions.sql
-- ═══════════════════════════════════════════════════════════
-- ───────────────────────────────────────────────
-- Digital wallet — document vault
-- ───────────────────────────────────────────────
create table if not exists public.wallet_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  doc_type text not null, -- 'pan' | 'aadhaar' | 'driving_license' | 'passport' | 'voter_id' | 'insurance' | 'other'
  doc_name text not null,
  custom_label text,
  front_url text,
  back_url text,
  has_back boolean default true,
  created_at timestamptz default now()
);
alter table public.wallet_documents enable row level security;
create policy "wallet_owner_only" on public.wallet_documents
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create index if not exists idx_wallet_owner on public.wallet_documents(owner_id);

-- Storage: private "wallet" bucket (same pattern as receipts)
insert into storage.buckets (id, name, public)
values ('wallet', 'wallet', false)
on conflict (id) do nothing;

create policy "wallet_owner_read" on storage.objects
  for select using (
    bucket_id = 'wallet' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "wallet_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'wallet' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "wallet_owner_update" on storage.objects
  for update using (
    bucket_id = 'wallet' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "wallet_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'wallet' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ───────────────────────────────────────────────
-- Profile links (Linktree-style)
-- ───────────────────────────────────────────────
create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  platform text not null,
  platform_label text not null,
  url text not null,
  display_name text,
  is_public boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);
alter table public.profile_links enable row level security;
create policy "links_owner_only" on public.profile_links
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- The public profile page reads public links without auth
create policy "links_public_read" on public.profile_links
  for select using (is_public = true);
create index if not exists idx_links_owner on public.profile_links(owner_id, sort_order);
create index if not exists idx_links_public on public.profile_links(owner_id) where is_public = true;

-- ───────────────────────────────────────────────
-- Public profile read on users (display_name + photo_url)
-- ───────────────────────────────────────────────
create policy "users_public_profile_read" on public.users
  for select using (true);

-- Hardening: the anonymous role can only ever read the harmless columns,
-- even though the row-level policy above is open. (Emails stay invisible
-- to logged-out visitors.)
revoke select on public.users from anon;
grant select (id, display_name, photo_url) on public.users to anon;
