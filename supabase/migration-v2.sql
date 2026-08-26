-- Incremental migration from the first public, anonymous recipe schema.

drop policy if exists "Public recipes are readable" on public.recipes;
drop policy if exists "Visitors can submit recipes" on public.recipes;

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.recipes
  add column user_id uuid not null references auth.users(id) on delete cascade,
  add column diet text not null default 'alle',
  add column allergens text[] not null default '{}'::text[],
  add column image_path text,
  add column updated_at timestamptz not null default now();

alter table public.recipes
  add constraint recipes_diet_allowed check (diet in ('alle', 'vegetar', 'vegansk')),
  add constraint recipes_allergens_allowed check (
    allergens <@ array[
      'gluten', 'melk', 'egg', 'notter', 'peanotter', 'soya',
      'fisk', 'skalldyr', 'sesam', 'selleri', 'sennep'
    ]::text[]
  ),
  add constraint recipes_allergens_count check (cardinality(allergens) <= 11),
  add constraint recipes_image_path_format check (
    image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  );

create table public.recipe_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table public.meal_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint meal_plans_plan_object check (jsonb_typeof(plan) = 'object'),
  constraint meal_plans_plan_size check (octet_length(plan::text) <= 200000)
);

create table public.recipe_reports (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_reports_reason_allowed check (reason in ('spam', 'stotende', 'feil', 'annet')),
  constraint recipe_reports_details_length check (char_length(details) <= 1000),
  constraint recipe_reports_status_allowed check (status in ('open', 'reviewed', 'closed')),
  constraint recipe_reports_once_per_user unique (recipe_id, reporter_id)
);

create table public.recipe_moderation (
  recipe_id bigint primary key references public.recipes(id) on delete cascade,
  status text not null default 'hidden',
  note text not null default '',
  moderated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint recipe_moderation_status_allowed check (status in ('hidden', 'published')),
  constraint recipe_moderation_note_length check (char_length(note) <= 500)
);

alter table public.admins enable row level security;
alter table public.recipe_favorites enable row level security;
alter table public.meal_plans enable row level security;
alter table public.recipe_reports enable row level security;
alter table public.recipe_moderation enable row level security;

create index recipes_user_id_idx on public.recipes (user_id);
create index recipes_published_allergens_idx on public.recipes using gin (allergens) where is_published = true;
create index recipe_favorites_recipe_id_idx on public.recipe_favorites (recipe_id);
create index recipe_reports_reporter_id_idx on public.recipe_reports (reporter_id);
create index recipe_reports_status_created_at_idx on public.recipe_reports (status, created_at desc);
create index recipe_moderation_moderated_by_idx on public.recipe_moderation (moderated_by);

revoke all on table public.admins from anon, authenticated;
revoke all on table public.recipes from anon, authenticated;
revoke all on table public.recipe_favorites from anon, authenticated;
revoke all on table public.meal_plans from anon, authenticated;
revoke all on table public.recipe_reports from anon, authenticated;
revoke all on table public.recipe_moderation from anon, authenticated;
revoke all on sequence public.recipes_id_seq from anon, authenticated;
revoke all on sequence public.recipe_reports_id_seq from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select (user_id) on public.admins to authenticated;
grant select on public.recipes to anon, authenticated;
grant insert (
  user_id, title, description, time_minutes, portions, calories, protein, carbs,
  fat, ingredients, instructions, prep_note, tags, diet, allergens, image_path
) on public.recipes to authenticated;
grant update (
  title, description, time_minutes, portions, calories, protein, carbs, fat,
  ingredients, instructions, prep_note, tags, diet, allergens, image_path, updated_at
) on public.recipes to authenticated;
grant delete on public.recipes to authenticated;
grant usage, select on sequence public.recipes_id_seq to authenticated;
grant select, insert, delete on public.recipe_favorites to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.recipe_reports to authenticated;
grant usage, select on sequence public.recipe_reports_id_seq to authenticated;
grant select (recipe_id, status) on public.recipe_moderation to anon, authenticated;
grant insert, update, delete on public.recipe_moderation to authenticated;

create policy "Admins can read their own role" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Anonymous users read published recipes" on public.recipes
  for select to anon
  using (
    is_published = true
    and not exists (
      select 1 from public.recipe_moderation moderation
      where moderation.recipe_id = recipes.id and moderation.status = 'hidden'
    )
  );

create policy "Authenticated users read allowed recipes" on public.recipes
  for select to authenticated
  using (
    (
      is_published = true
      and not exists (
        select 1 from public.recipe_moderation moderation
        where moderation.recipe_id = recipes.id and moderation.status = 'hidden'
      )
    )
    or (select auth.uid()) = user_id
    or exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
  );

create policy "Users can create their own recipes" on public.recipes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and is_published = true
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
  );

create policy "Owners can update their recipes" on public.recipes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
  );

create policy "Owners can delete their recipes" on public.recipes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users manage their favorites" on public.recipe_favorites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their meal plan" on public.meal_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can create their own reports" on public.recipe_reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id and status = 'open');

create policy "Users and admins read reports" on public.recipe_reports
  for select to authenticated
  using (
    (select auth.uid()) = reporter_id
    or exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
  );

create policy "Admins update reports" on public.recipe_reports
  for update to authenticated
  using (exists (select 1 from public.admins where admins.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins where admins.user_id = (select auth.uid())));

create policy "Admins delete reports" on public.recipe_reports
  for delete to authenticated
  using (exists (select 1 from public.admins where admins.user_id = (select auth.uid())));

create policy "Moderation status is readable" on public.recipe_moderation
  for select to anon, authenticated using (true);

create policy "Admins create recipe moderation" on public.recipe_moderation
  for insert to authenticated
  with check (
    exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
    and moderated_by = (select auth.uid())
  );

create policy "Admins update recipe moderation" on public.recipe_moderation
  for update to authenticated
  using (exists (select 1 from public.admins where admins.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
    and moderated_by = (select auth.uid())
  );

create policy "Admins delete recipe moderation" on public.recipe_moderation
  for delete to authenticated
  using (exists (select 1 from public.admins where admins.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images', 'recipe-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload recipe images to their folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can read metadata for their images" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-images' and owner_id = (select auth.uid())::text);

create policy "Users can delete their images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and owner_id = (select auth.uid())::text);

comment on table public.recipes is
  'MatPreppern recipes. Public users can read published recipes; authenticated owners manage their own content.';
comment on table public.admins is
  'Server-managed administrator allow-list. Never derive authorization from user_metadata.';
