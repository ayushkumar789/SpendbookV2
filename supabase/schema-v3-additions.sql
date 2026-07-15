-- ═══════════════════════════════════════════════════════════
-- SpendBook V3 additions — run ONLY this if schema.sql (and the
-- v2 additions) are already applied.
-- Adds: digital wallet (document vault), profile links + public
-- profile read access.
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
