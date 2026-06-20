-- Per-user favorite tickers (watchlist), moved off browser localStorage so a
-- favorite follows the account across browsers/devices instead of being pinned
-- to one machine. Favorites are a premium feature in the UI, and premium
-- requires login, so every writer is an authenticated user.

create table if not exists public.user_favorites (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  symbol     text        not null,
  created_at timestamptz not null default now(),
  -- one row per (user, symbol) → dedup is enforced by the DB, not the client.
  primary key (user_id, symbol)
);

-- Fast "list my favorites, oldest first" (the only read pattern).
create index if not exists user_favorites_user_created_idx
  on public.user_favorites (user_id, created_at);

alter table public.user_favorites enable row level security;

-- A user can only ever see and mutate their OWN rows. Anon (auth.uid() is null)
-- matches nothing → no access, which is the "login required" gate at the DB.
drop policy if exists user_favorites_select_own on public.user_favorites;
create policy user_favorites_select_own
  on public.user_favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_favorites_insert_own on public.user_favorites;
create policy user_favorites_insert_own
  on public.user_favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_favorites_delete_own on public.user_favorites;
create policy user_favorites_delete_own
  on public.user_favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);
