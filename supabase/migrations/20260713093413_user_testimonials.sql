-- User testimonials: one private moderation row per account, plus at most six
-- public, server-populated snapshots for the landing page.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create table if not exists public.testimonial_submissions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users (id) on delete cascade,
  display_name      text not null,
  persona           text not null,
  body              text not null,
  rating            smallint not null,
  status            text not null default 'pending',
  rejection_reason  text,
  reviewed_by       uuid references auth.users (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint testimonial_submissions_display_name_length
    check (char_length(display_name) between 2 and 40),
  constraint testimonial_submissions_persona_length
    check (char_length(persona) between 2 and 60),
  constraint testimonial_submissions_body_length
    check (char_length(body) between 20 and 500),
  constraint testimonial_submissions_rating_range
    check (rating between 1 and 5),
  constraint testimonial_submissions_status_valid
    check (status in ('pending', 'approved', 'rejected')),
  constraint testimonial_submissions_display_name_trimmed
    check (display_name = btrim(display_name)),
  constraint testimonial_submissions_persona_trimmed
    check (persona = btrim(persona)),
  constraint testimonial_submissions_body_trimmed
    check (body = btrim(body))
);

create index if not exists testimonial_submissions_status_updated_idx
  on public.testimonial_submissions (status, updated_at desc);

create table if not exists public.featured_testimonials (
  slot           smallint primary key,
  submission_id  uuid not null unique
    references public.testimonial_submissions (id) on delete cascade,
  display_name   text not null,
  persona        text not null,
  body           text not null,
  rating         smallint not null,
  published_at   timestamptz not null default now(),
  constraint featured_testimonials_slot_range
    check (slot between 1 and 6),
  constraint featured_testimonials_display_name_length
    check (char_length(display_name) between 2 and 40),
  constraint featured_testimonials_persona_length
    check (char_length(persona) between 2 and 60),
  constraint featured_testimonials_body_length
    check (char_length(body) between 20 and 500),
  constraint featured_testimonials_rating_range
    check (rating between 1 and 5)
);

-- Authors control only their content. Moderation columns are always stamped by
-- the database, and changing approved content immediately returns it to pending
-- and removes its public snapshot. SECURITY DEFINER is necessary here because
-- a normal author is intentionally denied DELETE on featured rows by RLS.
create or replace function private.enforce_testimonial_submission_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor              uuid := auth.uid();
  v_is_admin           boolean := coalesce(public.is_admin(), false);
  v_is_nonblocked      boolean;
  v_content_changed    boolean;
  v_moderation_changed boolean;
begin
  select exists (
    select 1
      from public.profiles as profile
     where profile.user_id = v_actor
       and not profile.is_blocked
  ) into v_is_nonblocked;

  new.display_name := btrim(new.display_name);
  new.persona := btrim(new.persona);
  new.body := btrim(new.body);
  new.rejection_reason := nullif(btrim(new.rejection_reason), '');

  if tg_op = 'INSERT' then
    if not v_is_admin and not v_is_nonblocked then
      raise exception 'blocked users cannot submit testimonials'
        using errcode = '42501';
    end if;

    new.status := 'pending';
    new.rejection_reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'testimonial identity fields are immutable'
      using errcode = '22023';
  end if;

  v_content_changed :=
    new.display_name is distinct from old.display_name
    or new.persona is distinct from old.persona
    or new.body is distinct from old.body
    or new.rating is distinct from old.rating;

  v_moderation_changed :=
    new.status is distinct from old.status
    or new.rejection_reason is distinct from old.rejection_reason
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at;

  if v_content_changed then
    if v_actor is distinct from old.user_id then
      raise exception 'only the testimonial author may edit its content'
        using errcode = '42501';
    end if;

    if not v_is_nonblocked then
      raise exception 'blocked users cannot edit testimonials'
        using errcode = '42501';
    end if;

    new.status := 'pending';
    new.rejection_reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif v_moderation_changed then
    if not v_is_admin then
      -- Allow the reviewed_by foreign key's ON DELETE SET NULL action. Browser
      -- callers always have auth.uid(), so they cannot use this maintenance path.
      if not (
        v_actor is null
        and old.reviewed_by is not null
        and new.reviewed_by is null
        and new.status is not distinct from old.status
        and new.rejection_reason is not distinct from old.rejection_reason
        and new.reviewed_at is not distinct from old.reviewed_at
      ) then
        raise exception 'only admins may moderate testimonials'
          using errcode = '42501';
      end if;
    else
      case new.status
        when 'approved' then
          new.rejection_reason := null;
          new.reviewed_by := v_actor;
          new.reviewed_at := now();
        when 'rejected' then
          new.reviewed_by := v_actor;
          new.reviewed_at := now();
        when 'pending' then
          new.rejection_reason := null;
          new.reviewed_by := null;
          new.reviewed_at := null;
        else
          raise exception 'invalid testimonial status'
            using errcode = '22023';
      end case;
    end if;
  end if;

  new.updated_at := now();

  if v_content_changed or new.status <> 'approved' then
    delete from public.featured_testimonials
     where submission_id = old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists testimonial_submissions_enforce_write
  on public.testimonial_submissions;
create trigger testimonial_submissions_enforce_write
  before insert or update on public.testimonial_submissions
  for each row execute function private.enforce_testimonial_submission_write();

-- Every featured row is a snapshot copied from an approved submission. Even a
-- direct admin table write cannot supply or alter the public snapshot fields.
create or replace function private.populate_featured_testimonial_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  select
    submission.display_name,
    submission.persona,
    submission.body,
    submission.rating
  into
    new.display_name,
    new.persona,
    new.body,
    new.rating
  from public.testimonial_submissions as submission
  where submission.id = new.submission_id
    and submission.status = 'approved';

  if not found then
    raise exception 'only approved testimonials may be featured'
      using errcode = '22023';
  end if;

  new.published_at := now();
  return new;
end;
$$;

drop trigger if exists featured_testimonials_populate_snapshot
  on public.featured_testimonials;
create trigger featured_testimonials_populate_snapshot
  before insert or update on public.featured_testimonials
  for each row execute function private.populate_featured_testimonial_snapshot();

-- Blocking an account is an immediate publication boundary. Keep the private
-- submission for the admin audit trail, but remove any public snapshot. This
-- covers both admin RPCs and direct trusted updates to profiles.is_blocked.
create or replace function private.unfeature_blocked_user_testimonials()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.is_blocked and new.is_blocked is distinct from old.is_blocked then
    delete from public.featured_testimonials as featured
    using public.testimonial_submissions as submission
    where featured.submission_id = submission.id
      and submission.user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_unfeature_blocked_testimonials
  on public.profiles;
create trigger profiles_unfeature_blocked_testimonials
  after update of is_blocked on public.profiles
  for each row execute function private.unfeature_blocked_user_testimonials();

revoke all on function private.enforce_testimonial_submission_write()
  from public, anon, authenticated, service_role;
revoke all on function private.populate_featured_testimonial_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function private.unfeature_blocked_user_testimonials()
  from public, anon, authenticated, service_role;

-- RLS keeps moderation data private to its author and admins. The featured table
-- contains public-only snapshots; authenticated DML is still admin-gated.
alter table public.testimonial_submissions enable row level security;
alter table public.featured_testimonials enable row level security;

drop policy if exists testimonial_submissions_select_own_or_admin
  on public.testimonial_submissions;
create policy testimonial_submissions_select_own_or_admin
  on public.testimonial_submissions
  for select
  to authenticated
  using (
    (
      (select auth.uid()) is not null
      and (select auth.uid()) = user_id
      and exists (
        select 1
          from public.profiles as profile
         where profile.user_id = (select auth.uid())
           and not profile.is_blocked
      )
    )
    or (select public.is_admin())
  );

drop policy if exists testimonial_submissions_insert_own_or_admin
  on public.testimonial_submissions;
create policy testimonial_submissions_insert_own_or_admin
  on public.testimonial_submissions
  for insert
  to authenticated
  with check (
    (
      (select auth.uid()) is not null
      and (select auth.uid()) = user_id
      and exists (
        select 1
          from public.profiles as profile
         where profile.user_id = (select auth.uid())
           and not profile.is_blocked
      )
    )
    or (select public.is_admin())
  );

drop policy if exists testimonial_submissions_update_own_or_admin
  on public.testimonial_submissions;
create policy testimonial_submissions_update_own_or_admin
  on public.testimonial_submissions
  for update
  to authenticated
  using (
    (
      (select auth.uid()) is not null
      and (select auth.uid()) = user_id
      and exists (
        select 1
          from public.profiles as profile
         where profile.user_id = (select auth.uid())
           and not profile.is_blocked
      )
    )
    or (select public.is_admin())
  )
  with check (
    (
      (select auth.uid()) is not null
      and (select auth.uid()) = user_id
      and exists (
        select 1
          from public.profiles as profile
         where profile.user_id = (select auth.uid())
           and not profile.is_blocked
      )
    )
    or (select public.is_admin())
  );

drop policy if exists testimonial_submissions_delete_own_or_admin
  on public.testimonial_submissions;
create policy testimonial_submissions_delete_own_or_admin
  on public.testimonial_submissions
  for delete
  to authenticated
  using (
    (
      (select auth.uid()) is not null
      and (select auth.uid()) = user_id
      and exists (
        select 1
          from public.profiles as profile
         where profile.user_id = (select auth.uid())
           and not profile.is_blocked
      )
    )
    or (select public.is_admin())
  );

drop policy if exists featured_testimonials_public_read
  on public.featured_testimonials;
create policy featured_testimonials_public_read
  on public.featured_testimonials
  for select
  to anon, authenticated
  using (true);

drop policy if exists featured_testimonials_admin_write
  on public.featured_testimonials;
create policy featured_testimonials_admin_write
  on public.featured_testimonials
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Explicit Data API exposure. Grants decide whether a role can reach a table;
-- the policies above independently decide which rows it may access.
revoke all on table public.testimonial_submissions
  from public, anon, authenticated, service_role;
revoke all on table public.featured_testimonials
  from public, anon, authenticated, service_role;

-- Author policies consult the caller's own RLS-protected profile. Make that
-- dependency explicit for projects using the new opt-in Data API grants.
grant select on table public.profiles to authenticated;
grant select, insert, update, delete
  on table public.testimonial_submissions to authenticated;
grant select
  on table public.featured_testimonials to anon, authenticated;
grant insert, update, delete
  on table public.featured_testimonials to authenticated;

-- Atomically move an approved submission into a slot, replacing its current
-- occupant. The trigger above copies the snapshot server-side.
create or replace function public.admin_set_featured_testimonial(
  p_submission_id uuid,
  p_slot smallint
)
returns public.featured_testimonials
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_featured public.featured_testimonials;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_slot is null or p_slot not between 1 and 6 then
    raise exception 'testimonial slot must be between 1 and 6'
      using errcode = '22023';
  end if;

  perform 1
    from public.testimonial_submissions
   where id = p_submission_id
     and status = 'approved'
   for update;

  if not found then
    raise exception 'approved testimonial not found'
      using errcode = 'P0002';
  end if;

  delete from public.featured_testimonials
   where submission_id = p_submission_id;

  insert into public.featured_testimonials (slot, submission_id)
  values (p_slot, p_submission_id)
  on conflict (slot) do update
    set submission_id = excluded.submission_id
  returning * into v_featured;

  return v_featured;
end;
$$;

-- Delete by submission, slot, or both. Passing both makes the match stricter;
-- passing neither is rejected so an accidental call can never clear all slots.
create or replace function public.admin_unfeature_testimonial(
  p_submission_id uuid default null,
  p_slot smallint default null
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_deleted_count bigint;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_submission_id is null and p_slot is null then
    raise exception 'submission_id or slot is required'
      using errcode = '22023';
  end if;

  if p_slot is not null and p_slot not between 1 and 6 then
    raise exception 'testimonial slot must be between 1 and 6'
      using errcode = '22023';
  end if;

  delete from public.featured_testimonials
   where (p_submission_id is null or submission_id = p_submission_id)
     and (p_slot is null or slot = p_slot);

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;

revoke all on function public.admin_set_featured_testimonial(uuid, smallint)
  from public, anon;
grant execute on function public.admin_set_featured_testimonial(uuid, smallint)
  to authenticated;

revoke all on function public.admin_unfeature_testimonial(uuid, smallint)
  from public, anon;
grant execute on function public.admin_unfeature_testimonial(uuid, smallint)
  to authenticated;
