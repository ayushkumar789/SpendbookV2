-- ═══════════════════════════════════════════════════════════
-- SpendBook v5 additions — run AFTER schema.sql + v2 + v3 + v4
-- 3-level sharing: View / Details / Edit links per book,
-- "saved shared books" on the receiver's home page, and the
-- RLS + RPC plumbing that makes each level safe.
-- ═══════════════════════════════════════════════════════════

-- ————— Books: one share id per access level —————

alter table public.books
  add column if not exists share_view_id uuid,
  add column if not exists share_details_id uuid,
  add column if not exists share_edit_id uuid,
  add column if not exists is_shared boolean default false;

-- Per-level Active/Paused toggle (Share modal). Paused = link stops resolving.
alter table public.books
  add column if not exists share_view_active boolean default true,
  add column if not exists share_details_active boolean default true,
  add column if not exists share_edit_active boolean default true;

-- Legacy share_id stays for backward compatibility but is no longer written.
-- Old links keep working read-only by promoting them to the View level.
update public.books
  set share_view_id = share_id
  where is_shared = true and share_id is not null and share_view_id is null;

create index if not exists idx_books_share_view on public.books(share_view_id) where is_shared = true;
create index if not exists idx_books_share_details on public.books(share_details_id) where is_shared = true;
create index if not exists idx_books_share_edit on public.books(share_edit_id) where is_shared = true;

-- ————— Saved shared books (receiver's home page) —————

create table if not exists public.saved_shared_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  book_id uuid not null,
  access_level text not null, -- 'view' | 'details' | 'edit'
  share_id_used uuid not null,
  owner_display_name text,
  book_name text,
  book_emoji text,
  book_color text,
  created_at timestamptz default now(),
  unique(user_id, book_id)
);

alter table public.saved_shared_books enable row level security;

create policy "owner only" on public.saved_shared_books
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_saved_shared_user on public.saved_shared_books(user_id);

-- ————— Resolve a share id → book + access level —————
-- SECURITY DEFINER so visitors can resolve a link without having (or
-- gaining) read access to the book's other share ids.

create or replace function public.resolve_share_access(p_share_id uuid)
returns table (
  book_id uuid,
  access_level text,
  owner_id uuid,
  owner_display_name text,
  name text,
  description text,
  color_tag text,
  icon_emoji text,
  monthly_budget numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id,
    case
      when b.share_edit_id = p_share_id then 'edit'
      when b.share_details_id = p_share_id then 'details'
      else 'view'
    end,
    b.owner_id,
    u.display_name,
    b.name,
    b.description,
    b.color_tag,
    b.icon_emoji,
    b.monthly_budget,
    b.created_at
  from public.books b
  left join public.users u on u.id = b.owner_id
  where b.is_shared = true
    and (
      (b.share_view_id = p_share_id and coalesce(b.share_view_active, true))
      or (b.share_details_id = p_share_id and coalesce(b.share_details_active, true))
      or (b.share_edit_id = p_share_id and coalesce(b.share_edit_active, true))
    )
  limit 1;
$$;

grant execute on function public.resolve_share_access(uuid) to anon, authenticated;

-- ————— Save a shared book to the receiver's home page —————
-- SECURITY DEFINER: validates the share id server-side so a client can
-- never insert a saved row (and gain edit rights) for a book it has no
-- valid link to. Returns true when the row was newly created.

create or replace function public.save_shared_book(p_share_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books%rowtype;
  v_level text;
  v_owner_name text;
  v_inserted boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_book
  from public.books b
  where b.is_shared = true
    and (b.share_view_id = p_share_id
      or b.share_details_id = p_share_id
      or b.share_edit_id = p_share_id)
  limit 1;

  if not found then
    raise exception 'Share link is not valid';
  end if;

  -- Your own book never lands in "Shared with me".
  if v_book.owner_id = auth.uid() then
    return false;
  end if;

  v_level := case
    when v_book.share_edit_id = p_share_id and coalesce(v_book.share_edit_active, true) then 'edit'
    when v_book.share_details_id = p_share_id and coalesce(v_book.share_details_active, true) then 'details'
    when v_book.share_view_id = p_share_id and coalesce(v_book.share_view_active, true) then 'view'
  end;

  if v_level is null then
    raise exception 'This share link is paused';
  end if;

  select display_name into v_owner_name from public.users where id = v_book.owner_id;

  insert into public.saved_shared_books
    (user_id, book_id, access_level, share_id_used, owner_display_name, book_name, book_emoji, book_color)
  values
    (auth.uid(), v_book.id, v_level, p_share_id, v_owner_name, v_book.name, v_book.icon_emoji, v_book.color_tag)
  on conflict (user_id, book_id) do update
    set access_level = excluded.access_level,
        share_id_used = excluded.share_id_used,
        owner_display_name = excluded.owner_display_name,
        book_name = excluded.book_name,
        book_emoji = excluded.book_emoji,
        book_color = excluded.book_color
  returning (xmax = 0) into v_inserted;

  return v_inserted;
end;
$$;

grant execute on function public.save_shared_book(uuid) to authenticated;

-- ————— Transactions: write access for Edit-level members —————
-- The credential is knowing share_edit_id: save_shared_book() stores it in
-- saved_shared_books, and these policies require the saved share_id_used to
-- still equal the book's current share_edit_id (so Reset link revokes).

create policy "tx_insert_shared_editor" on public.transactions
  for insert with check (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.books b
      join public.saved_shared_books s
        on s.book_id = b.id and s.user_id = auth.uid()
      where b.id = transactions.book_id
        and b.is_shared = true
        and b.share_edit_id is not null
        and coalesce(b.share_edit_active, true)
        and s.share_id_used = b.share_edit_id
    )
  );

create policy "tx_update_shared_editor" on public.transactions
  for update using (
    exists (
      select 1
      from public.books b
      join public.saved_shared_books s
        on s.book_id = b.id and s.user_id = auth.uid()
      where b.id = transactions.book_id
        and b.is_shared = true
        and b.share_edit_id is not null
        and coalesce(b.share_edit_active, true)
        and s.share_id_used = b.share_edit_id
    )
  )
  with check (
    exists (
      select 1
      from public.books b
      join public.saved_shared_books s
        on s.book_id = b.id and s.user_id = auth.uid()
      where b.id = transactions.book_id
        and b.is_shared = true
        and b.share_edit_id is not null
        and coalesce(b.share_edit_active, true)
        and s.share_id_used = b.share_edit_id
    )
  );

create policy "tx_delete_shared_editor" on public.transactions
  for delete using (
    exists (
      select 1
      from public.books b
      join public.saved_shared_books s
        on s.book_id = b.id and s.user_id = auth.uid()
      where b.id = transactions.book_id
        and b.is_shared = true
        and b.share_edit_id is not null
        and coalesce(b.share_edit_active, true)
        and s.share_id_used = b.share_edit_id
    )
  );

-- ————— Details/Edit levels: payment methods + contacts become readable —————
-- Only rows actually referenced by a transaction of a Details- or
-- Edit-shared book. View-level visitors still can't read them.

create policy "pm_select_shared_details" on public.payment_methods
  for select using (
    exists (
      select 1
      from public.transactions t
      join public.books b on b.id = t.book_id
      where (t.payment_method_id = payment_methods.id
          or t.transfer_to_payment_method_id = payment_methods.id)
        and b.is_shared = true
        and (
          (b.share_details_id is not null and coalesce(b.share_details_active, true))
          or (b.share_edit_id is not null and coalesce(b.share_edit_active, true))
        )
    )
  );

create policy "contacts_select_shared_details" on public.contacts
  for select using (
    exists (
      select 1
      from public.transactions t
      join public.books b on b.id = t.book_id
      where t.contact_id = contacts.id
        and b.is_shared = true
        and (
          (b.share_details_id is not null and coalesce(b.share_details_active, true))
          or (b.share_edit_id is not null and coalesce(b.share_edit_active, true))
        )
    )
  );

-- ————— Hardening: hide share ids from logged-out visitors —————
-- The row-level "books_select_shared" policy stays (shared views + realtime
-- need it), but the anon role can no longer read any share id column, so a
-- View-level visitor cannot lift the Details/Edit codes off the row.
-- (Authenticated clients keep full column access because the app's frozen
-- queries use select *; the share resolution path still goes through the
-- SECURITY DEFINER function above.)

revoke select on public.books from anon;
grant select (id, owner_id, name, description, color_tag, icon_emoji,
              monthly_budget, is_shared, created_at)
  on public.books to anon;
