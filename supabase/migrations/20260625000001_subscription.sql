-- Make the /subscription page DATA-DRIVEN: plans (price/benefit) and payment
-- channels move out of i18n + hardcoded PaymentDialog into admin-editable rows.
-- Copy is bilingual JSONB ({ "en": ..., "id": ... }) so the EN/ID toggle keeps
-- working. Unlike journal_assets (premium-read), these are PUBLIC-read — the
-- pricing page is anonymous. Admin writes are gated by is_admin()
-- (from 20260617000001_journal_assets.sql). Same data-driven spirit as
-- journal_assets / journal_settings.

-- 1. subscription_plans — one row per pricing card.
create table if not exists public.subscription_plans (
  slug           text primary key,                 -- 'basic' | 'professional' | 'ultimate'
  sort_order     int  not null default 0,
  name           jsonb not null,                   -- {"en":"Veteran","id":"Sepuh"}
  description    jsonb not null default '{}'::jsonb,
  price          jsonb not null,                   -- {"en":"$7","id":"Rp100rb"}
  original_price jsonb,                             -- null = no strikethrough/discount
  features       jsonb not null default '{}'::jsonb,-- {"en":[...],"id":[...]}
  icon           text,                              -- lucide name (Terminal|Zap|Shield)
  highlighted    boolean not null default false,    -- the "Best seller" card
  cta_kind       text not null default 'link'
                   check (cta_kind in ('link', 'payment', 'license', 'contact')),
  cta_link       text,
  active         boolean not null default true,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null
);

alter table public.subscription_plans enable row level security;

-- PUBLIC read (anonymous pricing page) + admin write. Mirrors the
-- journal_assets shape: a broad SELECT policy + an admin FOR ALL policy.
drop policy if exists subscription_plans_public_read on public.subscription_plans;
create policy subscription_plans_public_read
  on public.subscription_plans
  for select
  to anon, authenticated
  using (true);

drop policy if exists subscription_plans_admin_all on public.subscription_plans;
create policy subscription_plans_admin_all
  on public.subscription_plans
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. payment_methods — channels rendered on /subscription + in the PaymentDialog.
create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  sort_order   int  not null default 0,
  category     text not null check (category in ('bank', 'ewallet', 'qris', 'crypto')),
  name         text not null,                       -- 'BCA', 'E-Wallet', 'BEP20 (USDT)'
  account_no   text,                                -- account number / wallet address
  account_name text,                                -- beneficiary
  note         jsonb,                               -- bilingual sub-label, optional
  icon         text,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.payment_methods enable row level security;

drop policy if exists payment_methods_public_read on public.payment_methods;
create policy payment_methods_public_read
  on public.payment_methods
  for select
  to anon, authenticated
  using (true);

drop policy if exists payment_methods_admin_all on public.payment_methods;
create policy payment_methods_admin_all
  on public.payment_methods
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Seed from the CURRENT i18n + PaymentDialog values so nothing changes
--    visually on first deploy. on conflict do nothing → safe to re-run.
insert into public.subscription_plans
  (slug, sort_order, name, description, price, original_price, features, icon, highlighted, cta_kind, cta_link)
values
  (
    'basic', 1,
    '{"en":"Citizen","id":"Warga"}',
    '{"en":"For those just taste testing the market. Standard features to avoid FOMO.","id":"Buat yang baru mau nyicip market. Fitur standar biar gak FOMO."}',
    '{"en":"$0","id":"Rp0"}',
    null,
    '{"en":["Real time Screener (Limit 20 assets)","Standard Signals","Standard Economic Analysis"],"id":["Pemindai Langsung (Batas 20 aset)","Sinyal Standar","Analisis Ekonomi Standar"]}',
    'Terminal', false, 'link', '/terminal'
  ),
  (
    'professional', 2,
    '{"en":"Veteran","id":"Sepuh"}',
    '{"en":"Serious mode for those ready to go full throttle. Accurate signals, solid gains.","id":"Mode serius buat yang mau gaspol. Sinyal akurat, cuan makin mantap."}',
    '{"en":"$7","id":"Rp100rb"}',
    '{"en":"$20","id":"Rp300rb"}',
    '{"en":["Unlimited Asset Screener","Advanced Signal Engine (Grade A/B)","Full Economic Analysis","Custom List Favorites","Advanced Trading Plan","Trade Analysis (Chart Data)","Auto Trade Journal","Automatic Signal Notification","Integrated Community Group"],"id":["Pemindai Aset Tanpa Batas","Mesin Sinyal Canggih (Tingkat A/B)","Analisis Ekonomi Lengkap","Daftar Favorit Khusus","Rencana Transaksi Canggih","Analisis Transaksi (Data Grafik)","Jurnal Transaksi Otomatis","Notifikasi Sinyal Otomatis","Grup Komunitas Terpadu"]}',
    'Zap', true, 'payment', null
  ),
  (
    'ultimate', 3,
    '{"en":"Lord","id":"Raja"}',
    '{"en":"The highest tier for whales. Heavyweight data, lightning fast support.","id":"Kasta tertinggi buat para bandar. Data kelas berat, bantuan gacor."}',
    '{"en":"Custom","id":"Khusus"}',
    null,
    '{"en":["Full API Access","Dedicated Account Manager","Unlimited Asset Screener","Advanced Signal Engine (Grade A/B)","Full Economic Analysis","Custom List Favorites","Advanced Trading Plan","Trade Analysis (Chart Data)","Auto Trade Journal","Automatic Signal Notification","Integrated Community Group"],"id":["Akses API Lengkap","Manajer Akun Khusus","Pemindai Aset Tanpa Batas","Mesin Sinyal Canggih (Tingkat A/B)","Analisis Ekonomi Lengkap","Daftar Favorit Khusus","Rencana Transaksi Canggih","Analisis Transaksi (Data Grafik)","Jurnal Transaksi Otomatis","Notifikasi Sinyal Otomatis","Grup Komunitas Terpadu"]}',
    'Shield', false, 'contact', 'https://t.me/nailnafir'
  )
on conflict (slug) do nothing;

-- Guard on an empty table (no natural unique key here) so re-running can't
-- duplicate the seed rows.
insert into public.payment_methods
  (sort_order, category, name, account_no, account_name, note, icon)
select * from (values
  (1, 'bank',    'BCA',          '3450927189',                                 'Nailul Firdaus', null::jsonb, 'Landmark'),
  (2, 'bank',    'BNI',          '1868303386',                                 'Nailul Firdaus', null::jsonb, 'Landmark'),
  (3, 'bank',    'SEABANK',      '901623541860',                               'Nailul Firdaus', null::jsonb, 'Landmark'),
  (4, 'bank',    'JAGO',         '109072419650',                               'Nailul Firdaus', null::jsonb, 'Landmark'),
  (5, 'ewallet', 'E-Wallet',     '081288070110',                               'Nailul Firdaus',
     '{"en":"ShopeePay, GoPay, DANA, OVO, LinkAja","id":"ShopeePay, GoPay, DANA, OVO, LinkAja"}'::jsonb, 'Wallet'),
  (6, 'crypto',  'BEP20 (USDT)', '0x02319a99c28794b9400f0598d7581575ccb5236f', 'Nailul Firdaus',
     '{"en":"BNB Smart Chain network","id":"Jaringan BNB Smart Chain"}'::jsonb, 'Coins')
) as v(sort_order, category, name, account_no, account_name, note, icon)
where not exists (select 1 from public.payment_methods);
