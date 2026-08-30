-- Engine-v4 records the terminal event separately from TP progress/status.
-- Closed historical rows remain null and are interpreted by the app fallback.
alter table public.journal_trades
  add column if not exists exit_reason text;

alter table public.journal_trades
  drop constraint if exists journal_trades_exit_reason_check;

alter table public.journal_trades
  add constraint journal_trades_exit_reason_check
  check (
    exit_reason is null
    or exit_reason in (
      'initial_stop',
      'breakeven_stop',
      'progressive_stop',
      'final_take_profit',
      'reversal'
    )
  );

comment on column public.journal_trades.exit_reason is
  'Exact terminal event; null for open and pre-v4 historical rows.';

-- Unresolved engine-v3 positions immediately adopt the v4 progressive stop.
update public.journal_trades
set engine_version = 'engine-v4',
    exit_reason = null
where status = 'open'
  and engine_version is distinct from 'engine-v4';
