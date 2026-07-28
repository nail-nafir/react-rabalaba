-- Legacy seed rows predate persisted asset names. Reuse the latest Yahoo name
-- already stored on journal trades, then cover the three seed symbols without
-- trade history. Existing names always win.
with latest_trade_names as (
  select distinct on (symbol)
    symbol,
    btrim(name) as name
  from public.journal_trades
  where nullif(btrim(name), '') is not null
    and upper(btrim(name)) <> upper(symbol)
  order by symbol, opened_at desc, created_at desc
)
update public.journal_assets as asset
set name = trade.name
from latest_trade_names as trade
where asset.symbol = trade.symbol
  and nullif(btrim(asset.name), '') is null;

update public.journal_assets as asset
set name = fallback.name
from (
  values
    ('DCII.JK', 'PT DCI Indonesia Tbk'),
    ('GOTO.JK', 'PT GoTo Gojek Tokopedia Tbk'),
    ('SINI.JK', 'PT Singaraja Putra Tbk')
) as fallback(symbol, name)
where asset.symbol = fallback.symbol
  and nullif(btrim(asset.name), '') is null;
