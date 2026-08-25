-- MatPreppern database schema
-- Run this in a dedicated Supabase project before adding the project URL and
-- publishable key to js/supabase-config.js.

create table if not exists public.recipes (
  id bigint generated always as identity primary key,
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
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(prep_note, '')
    )
  ) stored,
  constraint recipes_title_length check (char_length(title) between 2 and 120),
  constraint recipes_description_length check (
    char_length(description) between 10 and 1200
  ),
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
    tags <@ array[
      'proteinrik',
      'lavkalori',
      'student',
      'budsjett',
      'rask',
      'meal prep'
    ]::text[]
  ),
  constraint recipes_tags_count check (cardinality(tags) between 1 and 6)
);

alter table public.recipes enable row level security;

create index if not exists recipes_published_created_at_idx
  on public.recipes (created_at desc)
  where is_published = true;
create index if not exists recipes_published_calories_idx
  on public.recipes (calories)
  where is_published = true;
create index if not exists recipes_published_protein_idx
  on public.recipes (protein desc)
  where is_published = true;
create index if not exists recipes_published_time_minutes_idx
  on public.recipes (time_minutes)
  where is_published = true;
create index if not exists recipes_published_tags_idx
  on public.recipes using gin (tags)
  where is_published = true;
create index if not exists recipes_published_search_vector_idx
  on public.recipes using gin (search_vector)
  where is_published = true;

revoke all on table public.recipes from anon, authenticated;
revoke all on sequence public.recipes_id_seq from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.recipes to anon, authenticated;
grant insert (
  title,
  description,
  time_minutes,
  portions,
  calories,
  protein,
  carbs,
  fat,
  ingredients,
  instructions,
  prep_note,
  tags
) on table public.recipes to anon, authenticated;
grant usage, select on sequence public.recipes_id_seq to anon, authenticated;

drop policy if exists "Public recipes are readable" on public.recipes;
create policy "Public recipes are readable"
  on public.recipes
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Visitors can submit recipes" on public.recipes;
create policy "Visitors can submit recipes"
  on public.recipes
  for insert
  to anon, authenticated
  with check (is_published = true);

comment on table public.recipes is
  'User-submitted MatPreppern recipes. Public clients may read and insert, but cannot update or delete.';
