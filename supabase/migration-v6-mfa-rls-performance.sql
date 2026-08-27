-- Follow-up for the already-deployed launch migration: make the MFA/admin predicate
-- an init-plan so Postgres evaluates it once per statement instead of once per row.

create or replace function public.has_verified_admin_session()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    exists (
      select 1 from public.admins
      where admins.user_id = (select auth.uid())
    )
    and coalesce(((select auth.jwt()) ->> 'aal') = 'aal2', false);
$$;

revoke all on function public.has_verified_admin_session() from public, anon;
grant execute on function public.has_verified_admin_session() to authenticated;

drop policy if exists "Authenticated users read allowed recipes" on public.recipes;
create policy "Authenticated users read allowed recipes" on public.recipes
  for select to authenticated
  using (
    (
      is_published = true
      and archived_at is null
      and not exists (
        select 1 from public.recipe_moderation moderation
        where moderation.recipe_id = recipes.id and moderation.status = 'hidden'
      )
    )
    or (select auth.uid()) = user_id
    or (select public.has_verified_admin_session())
  );

-- Every administrator action requires an AAL2 session. Reading one's own role stays available at AAL1.
drop policy if exists "Users and admins read reports" on public.recipe_reports;
create policy "Users and admins read reports" on public.recipe_reports
  for select to authenticated
  using (
    (select auth.uid()) = reporter_id
    or (
      (select public.has_verified_admin_session())
    )
  );

drop policy if exists "Admins update reports" on public.recipe_reports;
create policy "Admins update reports" on public.recipe_reports
  for update to authenticated
  using (
    (select public.has_verified_admin_session())
  )
  with check (
    (select public.has_verified_admin_session())
  );

drop policy if exists "Admins delete reports" on public.recipe_reports;
create policy "Admins delete reports" on public.recipe_reports
  for delete to authenticated
  using (
    (select public.has_verified_admin_session())
  );

drop policy if exists "Admins create recipe moderation" on public.recipe_moderation;
create policy "Admins create recipe moderation" on public.recipe_moderation
  for insert to authenticated
  with check (
    (select public.has_verified_admin_session())
    and moderated_by = (select auth.uid())
  );

drop policy if exists "Admins update recipe moderation" on public.recipe_moderation;
create policy "Admins update recipe moderation" on public.recipe_moderation
  for update to authenticated
  using (
    (select public.has_verified_admin_session())
  )
  with check (
    (select public.has_verified_admin_session())
    and moderated_by = (select auth.uid())
  );

drop policy if exists "Admins delete recipe moderation" on public.recipe_moderation;
create policy "Admins delete recipe moderation" on public.recipe_moderation
  for delete to authenticated
  using (
    (select public.has_verified_admin_session())
  );

drop policy if exists "Admins feature recipes" on public.recipe_features;
create policy "Admins feature recipes" on public.recipe_features
  for insert to authenticated
  with check (
    (select public.has_verified_admin_session())
    and featured_by = (select auth.uid())
    and exists (
      select 1 from public.recipes
      where recipes.id = recipe_id
        and recipes.is_published = true
        and recipes.archived_at is null
    )
  );

drop policy if exists "Admins remove recipe features" on public.recipe_features;
create policy "Admins remove recipe features" on public.recipe_features
  for delete to authenticated
  using (
    (select public.has_verified_admin_session())
  );

drop policy if exists "Authenticated users read community notes" on public.community_notes;
create policy "Authenticated users read community notes" on public.community_notes
  for select to authenticated
  using (
    is_published = true
    or (
      (select public.has_verified_admin_session())
    )
  );

drop policy if exists "Admins create community notes" on public.community_notes;
create policy "Admins create community notes" on public.community_notes
  for insert to authenticated
  with check (
    (select public.has_verified_admin_session())
    and author_id = (select auth.uid())
    and updated_by = (select auth.uid())
  );

drop policy if exists "Admins update community notes" on public.community_notes;
create policy "Admins update community notes" on public.community_notes
  for update to authenticated
  using (
    (select public.has_verified_admin_session())
  )
  with check (
    (select public.has_verified_admin_session())
    and updated_by = (select auth.uid())
  );

drop policy if exists "Admins delete community notes" on public.community_notes;
create policy "Admins delete community notes" on public.community_notes
  for delete to authenticated
  using (
    (select public.has_verified_admin_session())
  );
