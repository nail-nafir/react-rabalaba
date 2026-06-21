-- Rename the no-TP reversal close status 'manual' → 'reversed' so the wording
-- matches the journal_trades.reversed flag (and the UI "Reversed" label). The
-- CHECK keeps 'manual' allowed too, so this migration is safe to apply in EITHER
-- order vs `deploy:edge` (the old engine still writes 'manual' until redeploy;
-- the new one writes 'reversed'). 'manual' is legacy/transitional after this.
alter table journal_trades drop constraint if exists journal_trades_status_check;

update journal_trades set status = 'reversed' where status = 'manual';

alter table journal_trades
  add constraint journal_trades_status_check
  check (status in ('open', 'tp1', 'tp2', 'tp3', 'sl', 'reversed', 'manual'));
