-- Mark trades closed by a SIGNAL REVERSAL (vs a real price TP/SL hit).
-- A reversal can secure a TP (status tp{n}) or none (status manual). Without this
-- flag the UI can't tell a reversal-after-TP apart from a stop-after-TP — both are
-- stored as status tp{n}. The R/accounting stays at the secured TP (unchanged);
-- this is display-only so the journal can show "TP1/3 · Dibalik Arah".
alter table journal_trades
  add column if not exists reversed boolean not null default false;
