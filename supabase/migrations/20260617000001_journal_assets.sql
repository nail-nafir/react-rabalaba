-- Fase 6 — make the auto-journal universe DATA-DRIVEN.
-- Until now the cron's symbol list (EDGE_UNIVERSE) was bundled into _engine.mjs at
-- build time, so adding/removing an asset meant edit-constants → build:edge →
-- deploy:edge. This table moves the universe to runtime data: the Edge Function
-- reads `journal_assets` each run (service-role, bypasses RLS), so a new asset is
-- just a row — no rebuild, no redeploy. Managed via the in-app admin UI.

-- 1. journal_assets — the cron's universe. `symbol` is the Yahoo ticker (identity),
--    same string the journal_trades rows key off. name/asset_type are convenience
--    metadata for the admin UI; the cron still derives the real name + type from
--    the Yahoo response via adaptYahooChart at fetch time.
create table if not exists public.journal_assets (
  symbol      text primary key,
  name        text,
  asset_type  text,
  active      boolean     not null default true,
  sort_order  int,
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 2. Seed the current EDGE_UNIVERSE (mirrors src/constants/assets.ts at seed time:
--    TOP crypto/US/ID + DEFAULT commodity/forex). asset_type follows the Yahoo
--    suffix convention used by detectAssetType() in yahoo-adapter.ts.
insert into public.journal_assets (symbol, asset_type) values
  -- crypto (-USD)
  ('BTC-USD', 'crypto'), ('ETH-USD', 'crypto'), ('BNB-USD', 'crypto'),
  ('SOL-USD', 'crypto'), ('DOGE-USD', 'crypto'), ('SHIB-USD', 'crypto'),
  ('ZEC-USD', 'crypto'), ('WLD-USD', 'crypto'), ('HYPE32196-USD', 'crypto'),
  ('SUI20947-USD', 'crypto'), ('TON11419-USD', 'crypto'), ('FET-USD', 'crypto'),
  ('ONDO-USD', 'crypto'), ('SEI-USD', 'crypto'), ('RENDER-USD', 'crypto'),
  ('UNI7083-USD', 'crypto'), ('PENGU34466-USD', 'crypto'), ('GMT18069-USD', 'crypto'),
  ('ENA-USD', 'crypto'), ('PENDLE-USD', 'crypto'), ('ARKM-USD', 'crypto'),
  ('OP-USD', 'crypto'), ('TIA-USD', 'crypto'), ('ARB11841-USD', 'crypto'),
  ('JTO-USD', 'crypto'), ('JUP29210-USD', 'crypto'), ('SKYAI-USD', 'crypto'),
  ('RAY-USD', 'crypto'), ('EIGEN-USD', 'crypto'), ('QNT-USD', 'crypto'),
  ('S32684-USD', 'crypto'), ('MYX36410-USD', 'crypto'), ('INJ-USD', 'crypto'),
  ('LINK-USD', 'crypto'), ('PEPE24478-USD', 'crypto'), ('MORPHO34104-USD', 'crypto'),
  ('XRP-USD', 'crypto'), ('TRX-USD', 'crypto'),
  -- us-stock
  ('AAPL', 'us-stock'), ('MSFT', 'us-stock'), ('GOOGL', 'us-stock'),
  ('AMZN', 'us-stock'), ('NVDA', 'us-stock'), ('TSM', 'us-stock'),
  ('INTC', 'us-stock'), ('AMD', 'us-stock'), ('META', 'us-stock'),
  ('MSTR', 'us-stock'), ('PLTR', 'us-stock'), ('HOOD', 'us-stock'),
  ('MU', 'us-stock'), ('JPM', 'us-stock'), ('NOK', 'us-stock'),
  ('TSLA', 'us-stock'), ('QCOM', 'us-stock'),
  -- id-stock (.JK)
  ('BBCA.JK', 'id-stock'), ('BBRI.JK', 'id-stock'), ('BMRI.JK', 'id-stock'),
  ('DCII.JK', 'id-stock'), ('TLKM.JK', 'id-stock'), ('BRPT.JK', 'id-stock'),
  ('BREN.JK', 'id-stock'), ('PTRO.JK', 'id-stock'), ('TPIA.JK', 'id-stock'),
  ('CUAN.JK', 'id-stock'), ('CDIA.JK', 'id-stock'), ('BUMI.JK', 'id-stock'),
  ('BRMS.JK', 'id-stock'), ('ENRG.JK', 'id-stock'), ('DEWA.JK', 'id-stock'),
  ('BNBR.JK', 'id-stock'), ('VKTR.JK', 'id-stock'), ('RAJA.JK', 'id-stock'),
  ('RATU.JK', 'id-stock'), ('MINA.JK', 'id-stock'), ('UANG.JK', 'id-stock'),
  ('BUVA.JK', 'id-stock'), ('MORA.JK', 'id-stock'), ('PANI.JK', 'id-stock'),
  ('EMAS.JK', 'id-stock'), ('ANTM.JK', 'id-stock'), ('BRIS.JK', 'id-stock'),
  ('DSSA.JK', 'id-stock'), ('UNVR.JK', 'id-stock'), ('ADRO.JK', 'id-stock'),
  ('ADMR.JK', 'id-stock'), ('MDKA.JK', 'id-stock'), ('GOTO.JK', 'id-stock'),
  ('SUPA.JK', 'id-stock'), ('WBSA.JK', 'id-stock'), ('RLCO.JK', 'id-stock'),
  ('COIN.JK', 'id-stock'), ('SINI.JK', 'id-stock'), ('BUKA.JK', 'id-stock'),
  ('BKSL.JK', 'id-stock'), ('ARTO.JK', 'id-stock'), ('KETR.JK', 'id-stock'),
  -- commodity (=F)
  ('GC=F', 'commodity'), ('SI=F', 'commodity'), ('CL=F', 'commodity'),
  ('NG=F', 'commodity'), ('HG=F', 'commodity'),
  -- forex (=X)
  ('EURUSD=X', 'forex'), ('GBPUSD=X', 'forex'), ('USDJPY=X', 'forex'),
  ('AUDUSD=X', 'forex'), ('USDCAD=X', 'forex'), ('USDCHF=X', 'forex'),
  ('USDIDR=X', 'forex'), ('SGDIDR=X', 'forex'), ('JPYIDR=X', 'forex'),
  ('CNYIDR=X', 'forex'), ('KRWIDR=X', 'forex'), ('EURIDR=X', 'forex')
on conflict (symbol) do nothing;

-- 3. profiles.is_admin — gates who may manage the universe from the browser.
--    Default false; flip the owner true once (see step 6).
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 4. is_admin() — SECURITY DEFINER helper so the policy stays simple and doesn't
--    depend on the caller's RLS over profiles. Mirrors is_premium()
--    (20260614000002). Returns false for anon (auth.uid() is null) → no access.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 5. RLS — the cron writes with the service-role key (bypasses RLS), so it always
--    sees every row. The only browser callers are admins (the admin UI); a single
--    FOR ALL policy covers read + insert/update/delete.
alter table public.journal_assets enable row level security;
drop policy if exists journal_assets_admin_all on public.journal_assets;
create policy journal_assets_admin_all
  on public.journal_assets
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6. One-time grant (run ONCE in the SQL Editor after the owner has signed up, so
--    the profiles row exists):
--   update public.profiles set is_admin = true
--   where user_id = (select id from auth.users where email = 'nf.nailulfirdaus@gmail.com');
