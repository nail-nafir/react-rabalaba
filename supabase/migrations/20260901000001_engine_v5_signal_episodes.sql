-- Engine v5: preserve candle-close provenance and enforce one trade per raw
-- signal episode. Existing open v4 trades keep their engine_version.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journal_trades'
      and column_name = 'decision_candle_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journal_trades'
      and column_name = 'decision_candle_open_at'
  ) then
    alter table public.journal_trades
      rename column decision_candle_at to decision_candle_open_at;
  end if;
end $$;

alter table public.journal_trades
  add column if not exists decision_candle_closed_at timestamptz;

create table if not exists public.journal_signal_states (
  symbol text not null,
  timeframe text not null,
  active_signal text,
  blocked_signal text,
  last_raw_signal text not null default 'neutral',
  decision_candle_open_at timestamptz,
  decision_candle_closed_at timestamptz,
  entry_price double precision,
  stop_loss double precision,
  take_profits double precision[] not null default '{}',
  risk_reward_ratio double precision,
  updated_at timestamptz not null default now(),
  primary key (symbol, timeframe),
  constraint journal_signal_states_timeframe_check
    check (timeframe in ('scalp', 'swing', 'position')),
  constraint journal_signal_states_active_check
    check (active_signal is null or active_signal in ('long', 'short')),
  constraint journal_signal_states_blocked_check
    check (blocked_signal is null or blocked_signal in ('long', 'short')),
  constraint journal_signal_states_raw_check
    check (last_raw_signal in ('long', 'short', 'neutral'))
);

insert into public.journal_signal_states (
  symbol,
  timeframe,
  active_signal,
  blocked_signal,
  last_raw_signal,
  decision_candle_open_at,
  decision_candle_closed_at,
  entry_price,
  stop_loss,
  take_profits,
  risk_reward_ratio,
  updated_at
)
select distinct on (symbol, timeframe)
  symbol,
  timeframe,
  signal,
  null,
  signal,
  decision_candle_open_at,
  decision_candle_closed_at,
  entry_price,
  stop_loss,
  take_profits,
  risk_reward_ratio,
  now()
from public.journal_trades
where status = 'open'
order by symbol, timeframe, opened_at desc
on conflict (symbol, timeframe) do update set
  active_signal = excluded.active_signal,
  decision_candle_open_at = excluded.decision_candle_open_at,
  decision_candle_closed_at = excluded.decision_candle_closed_at,
  entry_price = excluded.entry_price,
  stop_loss = excluded.stop_loss,
  take_profits = excluded.take_profits,
  risk_reward_ratio = excluded.risk_reward_ratio,
  updated_at = excluded.updated_at;

alter table public.journal_signal_states enable row level security;

revoke all on table public.journal_signal_states from public, anon, authenticated;
grant select on table public.journal_signal_states to anon, authenticated;
grant all on table public.journal_signal_states to service_role;

drop policy if exists journal_signal_states_terminal_read
  on public.journal_signal_states;
create policy journal_signal_states_terminal_read
  on public.journal_signal_states
  for select
  to anon, authenticated
  using (true);
