-- ═══════════════════════════════════════════════════════════
-- SpendBook v7 additions — run AFTER schema.sql + v2…v6
-- People: save other users' public profiles for quick access,
-- with live balance updates on the People page.
-- ═══════════════════════════════════════════════════════════

-- ————— Saved profiles ("People" section) —————

create table if not exists public.saved_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  saved_user_id uuid not null,
  saved_display_name text not null,
  saved_photo_url text,
  created_at timestamptz default now(),
  unique(user_id, saved_user_id)
);

alter table public.saved_profiles enable row level security;

create policy "owner only" on public.saved_profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_saved_profiles_user on public.saved_profiles(user_id);

-- ————— Realtime for live balances on the People page —————
-- Snapshot inserts/updates must reach subscribers so a saved person's
-- balance card refreshes without a reload. (Realtime still enforces RLS —
-- only snapshots of show_on_profile groups are visible to others via the
-- v6 "public snapshot read" policy.)

do $$
begin
  alter publication supabase_realtime add table public.account_balance_snapshots;
exception
  when duplicate_object then null;
end $$;
