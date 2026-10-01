-- engine-v7 banks 50% of the position at TP1 and 30% at TP2 (the rest rides to
-- TP3 or the active stop), so its realized result blends those legs with the
-- close. Older rows still exit the whole position at close_price. Float noise
-- within 1e-9 of entry counts as breakeven, which stays out of the sample —
-- mirroring computePnl in src/core/trade/follow-trade-model.ts.
-- The RPC shape and privileges stay unchanged.

create or replace function public.get_public_journal_success_rates()
returns table (symbol text, wins bigint, total bigint)
language sql
security definer
set search_path = ''
stable
as $$
  with closed as (
    select
      jt.symbol,
      jt.entry_price,
      jt.close_price,
      jt.take_profits,
      case when jt.signal = 'long' then 1 else -1 end as direction,
      case
        when coalesce(substring(jt.engine_version from '^engine-v(\d+)$')::int, 0) >= 7
          then greatest(0, least(
            jt.highest_tp_reached,
            coalesce(array_length(jt.take_profits, 1), 0) - 1,
            2
          ))
        else 0
      end as legs
    from public.journal_trades as jt
    where jt.status <> 'open'
      and jt.close_price is not null
  ),
  realized as (
    select
      symbol,
      entry_price,
      direction * (
        case when legs >= 1 then 0.5 * (take_profits[1] - entry_price) else 0 end
        + case when legs >= 2 then 0.3 * (take_profits[2] - entry_price) else 0 end
        + case legs when 0 then 1 when 1 then 0.5 else 0.2 end
          * (close_price - entry_price)
      ) as move
    from closed
  )
  select
    symbol,
    count(*) filter (where move > entry_price * 1e-9)::bigint as wins,
    count(*) filter (where abs(move) > entry_price * 1e-9)::bigint as total
  from realized
  group by symbol
  order by symbol;
$$;

revoke all on function public.get_public_journal_success_rates() from public;
grant execute on function public.get_public_journal_success_rates()
  to anon, authenticated;
