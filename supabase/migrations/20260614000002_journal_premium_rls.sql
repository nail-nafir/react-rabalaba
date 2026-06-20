-- Fase 5 — gate journal_trades READS to entitled users (premium or active
-- trial). Until now the read policy was `using (true)` = anyone could pull the
-- whole track record straight from the DB; the premium gate was client-side
-- only. The cron is unaffected: it writes with the service-role key, which
-- bypasses RLS entirely.

-- Entitlement check as a SECURITY DEFINER helper so the policy stays simple and
-- doesn't depend on the caller's RLS over profiles (it reads profiles directly).
-- Returns false for anon (auth.uid() is null) → no rows.
create or replace function public.is_premium()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and (
        tier = 'premium'
        or (tier = 'trial' and trial_expires_at > now())
      )
  );
$$;

revoke all on function public.is_premium() from public;
grant execute on function public.is_premium() to anon, authenticated;

-- Replace the public read with an entitlement-gated one (authenticated only;
-- anon gets no SELECT policy → zero rows).
drop policy if exists journal_trades_public_read on public.journal_trades;
drop policy if exists journal_trades_premium_read on public.journal_trades;
create policy journal_trades_premium_read
  on public.journal_trades
  for select
  to authenticated
  using (public.is_premium());
