-- MatPreppern database schema
-- Canonical schema for a new, dedicated Supabase project.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  time_minutes smallint not null,
  portions smallint not null,
  calories integer not null,
  protein numeric(6, 1) not null,
  carbs numeric(6, 1) not null,
  fat numeric(6, 1) not null,
  ingredients jsonb not null,
  instructions jsonb not null,
  prep_note text not null,
  tags text[] not null default array['meal prep']::text[],
  diet text not null default 'alle',
  allergens text[] not null default '{}'::text[],
  image_path text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(prep_note, '')
    )
  ) stored,
  constraint recipes_title_length check (char_length(title) between 2 and 120),
  constraint recipes_description_length check (char_length(description) between 10 and 1200),
  constraint recipes_time_range check (time_minutes between 1 and 1440),
  constraint recipes_portions_range check (portions between 1 and 100),
  constraint recipes_calories_range check (calories between 1 and 10000),
  constraint recipes_protein_range check (protein between 0 and 1000),
  constraint recipes_carbs_range check (carbs between 0 and 1000),
  constraint recipes_fat_range check (fat between 0 and 1000),
  constraint recipes_ingredients_array check (
    jsonb_typeof(ingredients) = 'array'
    and jsonb_array_length(ingredients) between 1 and 100
  ),
  constraint recipes_instructions_array check (
    jsonb_typeof(instructions) = 'array'
    and jsonb_array_length(instructions) between 1 and 50
  ),
  constraint recipes_prep_note_length check (char_length(prep_note) <= 800),
  constraint recipes_tags_allowed check (
    tags <@ array['proteinrik', 'lavkalori', 'student', 'budsjett', 'rask', 'meal prep']::text[]
  ),
  constraint recipes_tags_count check (cardinality(tags) between 1 and 6),
  constraint recipes_diet_allowed check (diet in ('alle', 'vegetar', 'vegansk')),
  constraint recipes_allergens_allowed check (
    allergens <@ array[
      'gluten', 'melk', 'egg', 'notter', 'peanotter', 'soya',
      'fisk', 'skalldyr', 'sesam', 'selleri', 'sennep'
    ]::text[]
  ),
  constraint recipes_allergens_count check (cardinality(allergens) <= 11),
  constraint recipes_image_path_format check (
    image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  )
);

create table if not exists public.recipe_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table if not exists public.meal_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint meal_plans_plan_object check (jsonb_typeof(plan) = 'object'),
  constraint meal_plans_plan_size check (octet_length(plan::text) <= 200000)
);

create table if not exists public.recipe_reports (
  id bigint generated always as identity primary key,
  recipe_id bigint references public.recipes(id) on delete set null,
  recipe_title text not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'open',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_reports_recipe_title_length check (char_length(recipe_title) between 2 and 120),
  constraint recipe_reports_reason_allowed check (reason in ('spam', 'stotende', 'feil', 'annet')),
  constraint recipe_reports_details_length check (char_length(details) <= 1000),
  constraint recipe_reports_status_allowed check (status in ('open', 'reviewed', 'closed')),
  constraint recipe_reports_admin_note_length check (char_length(admin_note) <= 1000),
  constraint recipe_reports_closed_note_required check (
    status <> 'closed' or char_length(btrim(admin_note)) >= 3
  ),
  constraint recipe_reports_once_per_user unique (recipe_id, reporter_id)
);

create table if not exists public.recipe_report_receipts (
  report_id bigint primary key references public.recipe_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);

comment on table public.recipe_report_receipts is
  'Tracks when a reporter last viewed updates to their own report.';

create table if not exists public.recipe_moderation (
  recipe_id bigint primary key references public.recipes(id) on delete cascade,
  status text not null default 'hidden',
  note text not null default '',
  moderated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint recipe_moderation_status_allowed check (status in ('hidden', 'published')),
  constraint recipe_moderation_note_length check (char_length(note) <= 500)
);

create table if not exists public.recipe_features (
  recipe_id bigint primary key references public.recipes(id) on delete cascade,
  featured_by uuid not null references auth.users(id) on delete restrict,
  featured_at timestamptz not null default now()
);

create table if not exists public.community_notes (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  is_published boolean not null default false,
  author_id uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_notes_title_length check (char_length(title) between 2 and 120),
  constraint community_notes_body_length check (char_length(body) between 10 and 5000)
);

alter table public.admins enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_favorites enable row level security;
alter table public.meal_plans enable row level security;
alter table public.recipe_reports enable row level security;
alter table public.recipe_report_receipts enable row level security;
alter table public.recipe_moderation enable row level security;
alter table public.recipe_features enable row level security;
alter table public.community_notes enable row level security;

create index if not exists recipes_user_id_idx on public.recipes (user_id);
create index if not exists recipes_published_created_at_idx on public.recipes (created_at desc) where is_published = true;
create index if not exists recipes_published_calories_idx on public.recipes (calories) where is_published = true;
create index if not exists recipes_published_protein_idx on public.recipes (protein desc) where is_published = true;
create index if not exists recipes_published_time_minutes_idx on public.recipes (time_minutes) where is_published = true;
create index if not exists recipes_published_tags_idx on public.recipes using gin (tags) where is_published = true;
create index if not exists recipes_published_allergens_idx on public.recipes using gin (allergens) where is_published = true;
create index if not exists recipes_published_search_vector_idx on public.recipes using gin (search_vector) where is_published = true;
create index if not exists recipe_favorites_recipe_id_idx on public.recipe_favorites (recipe_id);
create index if not exists recipe_reports_reporter_id_idx on public.recipe_reports (reporter_id);
create index if not exists recipe_reports_status_created_at_idx on public.recipe_reports (status, created_at desc);
create index if not exists recipe_report_receipts_user_id_idx on public.recipe_report_receipts (user_id);
create index if not exists recipe_moderation_moderated_by_idx on public.recipe_moderation (moderated_by);
create index if not exists recipe_features_featured_at_idx on public.recipe_features (featured_at desc);
create index if not exists recipe_features_featured_by_idx on public.recipe_features (featured_by);
create index if not exists community_notes_published_created_at_idx on public.community_notes (created_at desc) where is_published = true;
create index if not exists community_notes_author_id_idx on public.community_notes (author_id);
create index if not exists community_notes_updated_by_idx on public.community_notes (updated_by);

revoke all on table public.admins from anon, authenticated;
revoke all on table public.recipes from anon, authenticated;
revoke all on table public.recipe_favorites from anon, authenticated;
revoke all on table public.meal_plans from anon, authenticated;
revoke all on table public.recipe_reports from anon, authenticated;
revoke all on table public.recipe_report_receipts from anon, authenticated;
revoke all on table public.recipe_moderation from anon, authenticated;
revoke all on table public.recipe_features from anon, authenticated;
revoke all on table public.community_notes from anon, authenticated;
revoke all on sequence public.recipes_id_seq from anon, authenticated;
revoke all on sequence public.recipe_reports_id_seq from anon, authenticated;
revoke all on sequence public.community_notes_id_seq from anon, authenticated;

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
grant select (
  id, recipe_id, recipe_title, reporter_id, reason, details, status,
  admin_note, created_at, updated_at
) on public.recipe_reports to authenticated;
grant insert (
  recipe_id, recipe_title, reporter_id, reason, details
) on public.recipe_reports to authenticated;
grant update (
  status, admin_note, updated_at
) on public.recipe_reports to authenticated;
grant delete on public.recipe_reports to authenticated;
grant usage, select on sequence public.recipe_reports_id_seq to authenticated;
grant select on public.recipe_report_receipts to authenticated;
grant insert (report_id, user_id, seen_at) on public.recipe_report_receipts to authenticated;
grant update (seen_at) on public.recipe_report_receipts to authenticated;
grant select (recipe_id, status) on public.recipe_moderation to anon, authenticated;
grant insert, update, delete on public.recipe_moderation to authenticated;

grant select (recipe_id, featured_at) on public.recipe_features to anon, authenticated;
grant insert (recipe_id, featured_by) on public.recipe_features to authenticated;
grant delete on public.recipe_features to authenticated;

grant select (id, title, body, is_published, created_at, updated_at)
  on public.community_notes to anon, authenticated;
grant insert (title, body, is_published, author_id, updated_by)
  on public.community_notes to authenticated;
grant update (title, body, is_published, updated_by, updated_at)
  on public.community_notes to authenticated;
grant delete on public.community_notes to authenticated;
grant usage, select on sequence public.community_notes_id_seq to authenticated;

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
  with check (
    (select auth.uid()) = reporter_id
    and status = 'open'
    and admin_note = ''
    and exists (
      select 1 from public.recipes
      where recipes.id = recipe_id
        and recipes.title = recipe_title
    )
  );

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

create policy "Users read their report receipts" on public.recipe_report_receipts
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.recipe_reports reports
      where reports.id = report_id
        and reports.reporter_id = (select auth.uid())
    )
  );

create policy "Users create their report receipts" on public.recipe_report_receipts
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.recipe_reports reports
      where reports.id = report_id
        and reports.reporter_id = (select auth.uid())
    )
  );

create policy "Users update their report receipts" on public.recipe_report_receipts
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.recipe_reports reports
      where reports.id = report_id
        and reports.reporter_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.recipe_reports reports
      where reports.id = report_id
        and reports.reporter_id = (select auth.uid())
    )
  );

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

create policy "Featured recipes are readable" on public.recipe_features
  for select to anon, authenticated using (true);

create policy "Admins feature recipes" on public.recipe_features
  for insert to authenticated
  with check (
    exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
    and featured_by = (select auth.uid())
  );

create policy "Admins remove recipe features" on public.recipe_features
  for delete to authenticated
  using (exists (select 1 from public.admins where admins.user_id = (select auth.uid())));

create policy "Anonymous users read published community notes" on public.community_notes
  for select to anon using (is_published = true);

create policy "Authenticated users read community notes" on public.community_notes
  for select to authenticated
  using (
    is_published = true
    or exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
  );

create policy "Admins create community notes" on public.community_notes
  for insert to authenticated
  with check (
    exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
    and author_id = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy "Admins update community notes" on public.community_notes
  for update to authenticated
  using (exists (select 1 from public.admins where admins.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.admins where admins.user_id = (select auth.uid()))
    and updated_by = (select auth.uid())
  );

create policy "Admins delete community notes" on public.community_notes
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
comment on table public.recipe_features is
  'Administrator-managed list of recipes highlighted by MatPreppern.';
comment on table public.community_notes is
  'Administrator-authored updates, clarifications and guidance for the MatPreppern community.';
