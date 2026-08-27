-- Launch hardening: public profiles, recipe archiving, paginated search and MFA-protected admin actions.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'MatPreppern-bruker',
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 60),
  constraint profiles_bio_length check (char_length(bio) <= 300)
);

insert into public.profiles (user_id)
select users.id from auth.users users
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;

alter table public.recipes
  add column if not exists archived_at timestamptz;

drop index if exists public.recipes_published_created_at_idx;
drop index if exists public.recipes_published_calories_idx;
drop index if exists public.recipes_published_protein_idx;
drop index if exists public.recipes_published_time_minutes_idx;
drop index if exists public.recipes_published_tags_idx;
drop index if exists public.recipes_published_allergens_idx;
drop index if exists public.recipes_published_search_vector_idx;

create index if not exists profiles_display_name_idx
  on public.profiles (lower(display_name));
create index if not exists recipes_user_archive_updated_idx
  on public.recipes (user_id, archived_at, updated_at desc);
create index if not exists recipes_active_created_at_idx
  on public.recipes (created_at desc)
  where is_published = true and archived_at is null;
create index if not exists recipes_active_calories_idx
  on public.recipes (calories)
  where is_published = true and archived_at is null;
create index if not exists recipes_active_protein_idx
  on public.recipes (protein desc)
  where is_published = true and archived_at is null;
create index if not exists recipes_active_time_idx
  on public.recipes (time_minutes)
  where is_published = true and archived_at is null;
create index if not exists recipes_active_tags_idx
  on public.recipes using gin (tags)
  where is_published = true and archived_at is null;
create index if not exists recipes_active_allergens_idx
  on public.recipes using gin (allergens)
  where is_published = true and archived_at is null;
create index if not exists recipes_active_search_vector_idx
  on public.recipes using gin (search_vector)
  where is_published = true and archived_at is null;

revoke all on table public.profiles from anon, authenticated;
grant select (user_id, display_name, bio, created_at, updated_at)
  on public.profiles to anon, authenticated;
grant insert (user_id) on public.profiles to authenticated;
grant update (display_name, bio, updated_at) on public.profiles to authenticated;

revoke delete on public.recipes from authenticated;
grant select (archived_at) on public.recipes to anon, authenticated;
grant update (archived_at) on public.recipes to authenticated;

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

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Anonymous users read published recipes" on public.recipes;
create policy "Anonymous users read published recipes" on public.recipes
  for select to anon
  using (
    is_published = true
    and archived_at is null
    and not exists (
      select 1 from public.recipe_moderation moderation
      where moderation.recipe_id = recipes.id and moderation.status = 'hidden'
    )
  );

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
    or (
      (select public.has_verified_admin_session())
    )
  );

drop policy if exists "Users can create their own recipes" on public.recipes;
create policy "Users can create their own recipes" on public.recipes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and is_published = true
    and archived_at is null
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
  );

drop policy if exists "Owners can update their recipes" on public.recipes;
create policy "Owners can update their recipes" on public.recipes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
  );

drop policy if exists "Owners can delete their recipes" on public.recipes;

create or replace function public.remove_feature_when_recipe_archived()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    delete from public.recipe_features where recipe_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.remove_feature_when_recipe_archived() from public, anon, authenticated;
drop trigger if exists remove_feature_when_recipe_archived on public.recipes;
create trigger remove_feature_when_recipe_archived
  after update of archived_at on public.recipes
  for each row execute function public.remove_feature_when_recipe_archived();

create or replace function public.search_recipes(
  p_search text default '',
  p_max_calories integer default null,
  p_min_protein numeric default 0,
  p_max_time integer default null,
  p_tag text default null,
  p_diet text default null,
  p_excluded_allergen text default null,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id bigint,
  user_id uuid,
  title text,
  description text,
  time_minutes smallint,
  portions smallint,
  calories integer,
  protein numeric,
  carbs numeric,
  fat numeric,
  ingredients jsonb,
  instructions jsonb,
  prep_note text,
  tags text[],
  diet text,
  allergens text[],
  image_path text,
  is_published boolean,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  is_featured boolean,
  author_name text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      recipes.id,
      recipes.user_id,
      recipes.title,
      recipes.description,
      recipes.time_minutes,
      recipes.portions,
      recipes.calories,
      recipes.protein,
      recipes.carbs,
      recipes.fat,
      recipes.ingredients,
      recipes.instructions,
      recipes.prep_note,
      recipes.tags,
      recipes.diet,
      recipes.allergens,
      recipes.image_path,
      recipes.is_published,
      recipes.archived_at,
      recipes.created_at,
      recipes.updated_at,
      (features.recipe_id is not null) as is_featured,
      coalesce(profiles.display_name, 'MatPreppern-bruker') as author_name
    from public.recipes recipes
    left join public.recipe_features features on features.recipe_id = recipes.id
    left join public.profiles profiles on profiles.user_id = recipes.user_id
    where recipes.is_published = true
      and recipes.archived_at is null
      and not exists (
        select 1 from public.recipe_moderation moderation
        where moderation.recipe_id = recipes.id and moderation.status = 'hidden'
      )
      and (
        nullif(btrim(p_search), '') is null
        or recipes.search_vector @@ plainto_tsquery('simple', p_search)
        or lower(recipes.ingredients::text) like '%' || lower(btrim(p_search)) || '%'
        or lower(recipes.title) like '%' || lower(btrim(p_search)) || '%'
      )
      and (p_max_calories is null or recipes.calories <= p_max_calories)
      and (coalesce(p_min_protein, 0) <= 0 or recipes.protein >= p_min_protein)
      and (p_max_time is null or p_max_time <= 0 or recipes.time_minutes <= p_max_time)
      and (nullif(p_tag, '') is null or p_tag = 'all' or recipes.tags @> array[p_tag]::text[])
      and (
        nullif(p_diet, '') is null
        or p_diet = 'all'
        or recipes.diet = p_diet
        or (p_diet = 'vegetar' and recipes.diet = 'vegansk')
      )
      and (
        nullif(p_excluded_allergen, '') is null
        or not (recipes.allergens @> array[p_excluded_allergen]::text[])
      )
  )
  select
    filtered.id,
    filtered.user_id,
    filtered.title,
    filtered.description,
    filtered.time_minutes,
    filtered.portions,
    filtered.calories,
    filtered.protein,
    filtered.carbs,
    filtered.fat,
    filtered.ingredients,
    filtered.instructions,
    filtered.prep_note,
    filtered.tags,
    filtered.diet,
    filtered.allergens,
    filtered.image_path,
    filtered.is_published,
    filtered.archived_at,
    filtered.created_at,
    filtered.updated_at,
    filtered.is_featured,
    filtered.author_name,
    count(*) over() as total_count
  from filtered
  order by
    case when p_sort = 'newest' and filtered.is_featured then 0 else 1 end,
    case when p_sort = 'newest' then filtered.created_at end desc,
    case when p_sort = 'alphabetical' then lower(filtered.title) end asc,
    case when p_sort = 'lowest-calories' then filtered.calories end asc,
    case when p_sort = 'highest-protein' then filtered.protein end desc,
    case when p_sort = 'fastest' then filtered.time_minutes end asc,
    case when p_sort = 'most-portions' then filtered.portions end desc,
    filtered.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.search_recipes(text, integer, numeric, integer, text, text, text, text, integer, integer)
  from public;
grant execute on function public.search_recipes(text, integer, numeric, integer, text, text, text, text, integer, integer)
  to anon, authenticated;

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

comment on table public.profiles is
  'Public, user-controlled profile information. Email addresses are never exposed here.';
comment on column public.recipes.archived_at is
  'Soft-delete timestamp. Archived recipes remain recoverable to their owner.';
comment on function public.search_recipes(text, integer, numeric, integer, text, text, text, text, integer, integer) is
  'RLS-aware public recipe search with filters, stable sorting and pagination.';
