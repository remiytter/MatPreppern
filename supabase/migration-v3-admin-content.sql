-- Add MatPreppern recipe highlighting and administrator-authored Community Notes.

create table public.recipe_features (
  recipe_id bigint primary key references public.recipes(id) on delete cascade,
  featured_by uuid not null references auth.users(id) on delete restrict,
  featured_at timestamptz not null default now()
);

create table public.community_notes (
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

alter table public.recipe_features enable row level security;
alter table public.community_notes enable row level security;

create index recipe_features_featured_at_idx on public.recipe_features (featured_at desc);
create index recipe_features_featured_by_idx on public.recipe_features (featured_by);
create index community_notes_published_created_at_idx on public.community_notes (created_at desc) where is_published = true;
create index community_notes_author_id_idx on public.community_notes (author_id);
create index community_notes_updated_by_idx on public.community_notes (updated_by);

revoke all on table public.recipe_features from anon, authenticated;
revoke all on table public.community_notes from anon, authenticated;
revoke all on sequence public.community_notes_id_seq from anon, authenticated;

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

comment on table public.recipe_features is
  'Administrator-managed list of recipes highlighted by MatPreppern.';
comment on table public.community_notes is
  'Administrator-authored updates, clarifications and guidance for the MatPreppern community.';
