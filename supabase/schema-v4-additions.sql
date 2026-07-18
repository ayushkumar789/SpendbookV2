-- ═══════════════════════════════════════════════════════════
-- SpendBook v4 additions — run AFTER schema.sql + v2 + v3
-- Adds: contacts table (+RLS), self-transfer column and
-- contact tagging on transactions.
-- ═══════════════════════════════════════════════════════════

-- ————— Contacts (people you frequently transact with) —————

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name text not null,
  phone text,
  avatar_color text not null,
  created_at timestamptz default now()
);

create index if not exists contacts_owner_idx on contacts(owner_id);

alter table contacts enable row level security;

create policy "owner only" on contacts
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ————— Transactions: self transfer + contact tag —————

-- Self transfer: type = 'transfer' (alongside 'in' | 'out').
-- payment_method_id is the FROM account; this column is the TO account.
alter table transactions
  add column if not exists transfer_to_payment_method_id uuid
    references payment_methods(id) on delete set null;

-- Optional person tag ("paid by Dad", "received from Rishi").
alter table transactions
  add column if not exists contact_id uuid
    references contacts(id) on delete set null;
