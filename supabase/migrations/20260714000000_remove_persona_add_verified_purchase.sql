-- Remove persona from testimonial_submissions and featured_testimonials
-- Add verified_purchase (boolean, default false, not null) to testimonial_submissions and featured_testimonials

-- Drop constraints related to persona
alter table public.testimonial_submissions drop constraint if exists testimonial_submissions_persona_length;
alter table public.testimonial_submissions drop constraint if exists testimonial_submissions_persona_trimmed;
alter table public.featured_testimonials drop constraint if exists featured_testimonials_persona_length;

-- Drop display name constraints to prevent issues with user-generated names from email splits (e.g. 1-character display names or very long names)
alter table public.testimonial_submissions drop constraint if exists testimonial_submissions_display_name_length;
alter table public.featured_testimonials drop constraint if exists featured_testimonials_display_name_length;

-- Modify columns
alter table public.testimonial_submissions drop column if exists persona;
alter table public.testimonial_submissions add column if not exists verified_purchase boolean not null default false;

alter table public.featured_testimonials drop column if exists persona;
alter table public.featured_testimonials add column if not exists verified_purchase boolean not null default false;

-- Recreate trigger function private.enforce_testimonial_submission_write()
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

  -- Automatically populate display_name from auth.users
  select coalesce(
    nullif(btrim(raw_user_meta_data->>'full_name'), ''),
    split_part(email, '@', 1)
  ) into new.display_name
  from auth.users
  where id = new.user_id;

  new.display_name := coalesce(btrim(new.display_name), 'User');
  new.body := btrim(new.body);
  new.rejection_reason := nullif(btrim(new.rejection_reason), '');

  -- Automatically populate verified_purchase based on profile tier
  select (tier = 'premium') into new.verified_purchase
  from public.profiles
  where user_id = new.user_id;

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
    new.body is distinct from old.body
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

-- Recreate trigger function private.populate_featured_testimonial_snapshot()
create or replace function private.populate_featured_testimonial_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  select
    submission.display_name,
    submission.verified_purchase,
    submission.body,
    submission.rating
  into
    new.display_name,
    new.verified_purchase,
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
