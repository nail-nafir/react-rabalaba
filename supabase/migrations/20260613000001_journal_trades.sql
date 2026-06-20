-- Global auto-journal track-record. One shared journal: the Cron Worker is the
-- ONLY writer (via the Supabase service-role key, which bypasses RLS); everyone
-- else gets read-only access. Columns mirror the FollowedTrade shape in
-- src/features/follow-trade/lib/follow-trade-model.ts so the worker can persist
-- buildFollowedTrade()/applyPriceSync() output 1:1.

create table if not exists public.journal_trades (
  id                  uuid primary key default gen_random_uuid(),
  symbol              text not null,
  name                text not null,
  asset_type          text not null,
  signal              text not null check (signal in ('long', 'short')),
  timeframe           text not null,
  entry_price         double precision not null,
  stop_loss           double precision not null,
  -- [tp1, tp2, tp3?] — only finite levels from the plan, in order.
  take_profits        double precision[] not null default '{}',
  risk_reward_ratio   double precision,
  strength_at_entry   double precision,
  grade               text check (grade in ('A', 'B', 'C')),
  -- FollowStatus: 'open' = live (UI shows "RUNNING TRADE"); the rest terminal.
  -- 'manual' is allowed for forward-compat but unused by the autonomous cron.
  status              text not null default 'open'
                        check (status in ('open', 'tp1', 'tp2', 'tp3', 'sl', 'manual')),
  highest_tp_reached  int  not null default 0,
  opened_at           timestamptz not null default now(),
  closed_at           timestamptz,
  close_price         double precision,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Dedup guard: at most ONE live trade per (symbol, timeframe). Mirrors the
-- client guard `openTrades.some((t) => t.symbol === asset.symbol)` and makes a
-- double-run of the cron idempotent — a second INSERT for an already-open
-- symbol/timeframe fails on this index instead of flooding the journal.
create unique index if not exists journal_trades_one_open_per_symbol_tf
  on public.journal_trades (symbol, timeframe)
  where status = 'open';

-- Hot paths: scanning live trades to sync, and ordering closed history.
create index if not exists journal_trades_open_idx
  on public.journal_trades (status) where status = 'open';
create index if not exists journal_trades_closed_at_idx
  on public.journal_trades (closed_at desc) where status <> 'open';

-- Keep updated_at honest on every UPDATE.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists journal_trades_set_updated_at on public.journal_trades;
create trigger journal_trades_set_updated_at
  before update on public.journal_trades
  for each row execute function public.set_updated_at();

-- RLS: global read-only journal. The cron writes with the service-role key,
-- which bypasses RLS, so we intentionally define NO insert/update/delete
-- policies for anon/authenticated — they can only read the track record.
alter table public.journal_trades enable row level security;

drop policy if exists journal_trades_public_read on public.journal_trades;
create policy journal_trades_public_read
  on public.journal_trades
  for select
  to anon, authenticated
  using (true);
