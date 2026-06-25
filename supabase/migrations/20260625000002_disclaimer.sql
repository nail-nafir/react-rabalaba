-- Move the risk-disclaimer clauses out of i18n into an admin-editable, VERSIONED
-- singleton, and RECORD acceptance per logged-in user (hybrid: anonymous visitors
-- keep their localStorage flag; only authenticated acceptances are persisted).
-- Bumping `version` re-prompts everyone. Singleton + public-read/admin-write
-- mirrors journal_settings; is_admin() from 20260617000001_journal_assets.sql.

-- 1. disclaimer — the single clause set (id is always true).
create table if not exists public.disclaimer (
  id            boolean primary key default true,
  version       int not null default 1,
  title         jsonb not null,
  description   jsonb not null,
  points        jsonb not null,          -- {"en":[...],"id":[...]}
  confirm_label jsonb not null,
  agree_label   jsonb not null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null,
  constraint disclaimer_singleton check (id = true)
);

alter table public.disclaimer enable row level security;

drop policy if exists disclaimer_public_read on public.disclaimer;
create policy disclaimer_public_read
  on public.disclaimer
  for select
  to anon, authenticated
  using (true);

drop policy if exists disclaimer_admin_all on public.disclaimer;
create policy disclaimer_admin_all
  on public.disclaimer
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed v1 from the current i18n `disclaimer.*` so nothing changes on first deploy.
insert into public.disclaimer
  (id, version, title, description, points, confirm_label, agree_label)
values
  (
    true, 1,
    '{"en":"Know The Risks","id":"Pahami Resikonya"}',
    '{"en":"The RabaLaba Research Terminal provides high octane intel, but please note these essential rules:","id":"RabaLaba Terminal Riset menyediakan data gacor, tapi tetep pahami beberapa poin ini:"}',
    '{"en":["Not financial advice, just pure data and research. Always do due diligence.","The pilot is in control, the terminal is the radar. All trading decisions and risks belong to the user alone.","Use cold capital only. Never trade with essential funds like rent or daily needs.","Market volatility is real. Stay disciplined and keep emotions in check.","This terminal is for perpetual derivative contracts, adjust if it does not fit your needs."],"id":["Bukan saran finansial, cuma data riset biar gak terjebak FOMO. Mandiri itu wajib.","Keputusan ada di tangan pengguna, risiko ditanggung sendiri. Kita cuma penyedia radar.","Gunakan uang dingin, jangan pake uang dapur apalagi hasil pinjaman online.","Market punya volatilitas tinggi, tetep disiplin dan jangan sampe kena mental.","Terminal ini prioritas buat kontrak derivatif perpetual, kalo gak cocok harap menyesuaikan."]}',
    '{"en":"I have read and understood the risk disclosure","id":"Saya telah membaca dan memahami risiko investasi"}',
    '{"en":"Understand & Proceed","id":"Paham & Lanjutkan"}'
  )
on conflict (id) do nothing;

-- 2. disclaimer_agreements — who accepted which version (audit + compliance).
create table if not exists public.disclaimer_agreements (
  user_id   uuid not null references auth.users (id) on delete cascade,
  version   int  not null,
  agreed_at timestamptz not null default now(),
  primary key (user_id, version)
);

alter table public.disclaimer_agreements enable row level security;

-- A user reads/inserts only their OWN acceptance; admins may read all (audit).
drop policy if exists disclaimer_agreements_select on public.disclaimer_agreements;
create policy disclaimer_agreements_select
  on public.disclaimer_agreements
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists disclaimer_agreements_insert_own on public.disclaimer_agreements;
create policy disclaimer_agreements_insert_own
  on public.disclaimer_agreements
  for insert
  to authenticated
  with check (auth.uid() = user_id);
