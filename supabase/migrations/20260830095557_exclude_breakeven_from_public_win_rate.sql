-- Keep public per-symbol win rate aligned with the journal: breakeven trades
-- remain recorded but are neither wins nor losses, so they leave the sample
-- denominator. The RPC shape and privileges stay unchanged.

create or replace function public.get_public_journal_success_rates()
returns table (symbol text, wins bigint, total bigint)
language sql
security definer
set search_path = ''
stable
as $$
  select jt.symbol,
    count(*) filter (
      where (jt.signal = 'long' and jt.close_price > jt.entry_price)
         or (jt.signal = 'short' and jt.close_price < jt.entry_price)
    )::bigint as wins,
    count(*) filter (
      where jt.close_price <> jt.entry_price
    )::bigint as total
  from public.journal_trades jt
  where jt.status <> 'open'
    and jt.close_price is not null
  group by jt.symbol
  order by jt.symbol;
$$;

revoke all on function public.get_public_journal_success_rates() from public;
grant execute on function public.get_public_journal_success_rates()
  to anon, authenticated;
