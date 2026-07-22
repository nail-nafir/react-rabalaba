-- Public, aggregate-only track record for the market screener. Raw
-- journal_trades rows remain protected by journal_trades_premium_read; this
-- endpoint deliberately exposes only per-symbol win and sample counts.

create index if not exists journal_trades_closed_symbol_stats_idx
  on public.journal_trades (symbol)
  include (signal, entry_price, close_price)
  where status <> 'open';

create or replace function public.get_public_journal_success_rates()
returns table (
  symbol text,
  wins bigint,
  total bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    jt.symbol,
    count(*) filter (
      where case jt.signal
        when 'long' then coalesce(jt.close_price, jt.entry_price) >= jt.entry_price
        when 'short' then coalesce(jt.close_price, jt.entry_price) <= jt.entry_price
        else false
      end
    )::bigint as wins,
    count(*)::bigint as total
  from public.journal_trades as jt
  where jt.status <> 'open'
  group by jt.symbol
  order by jt.symbol;
$$;

revoke all on function public.get_public_journal_success_rates() from public;
grant execute on function public.get_public_journal_success_rates()
  to anon, authenticated;
