-- Preserve moderation/content history while removing the deleted administrator's user ID.

alter table public.recipe_moderation alter column moderated_by drop not null;
alter table public.recipe_features alter column featured_by drop not null;
alter table public.community_notes alter column author_id drop not null;
alter table public.community_notes alter column updated_by drop not null;

alter table public.recipe_moderation
  drop constraint if exists recipe_moderation_moderated_by_fkey;
alter table public.recipe_moderation
  add constraint recipe_moderation_moderated_by_fkey
  foreign key (moderated_by) references auth.users(id) on delete set null;

alter table public.recipe_features
  drop constraint if exists recipe_features_featured_by_fkey;
alter table public.recipe_features
  add constraint recipe_features_featured_by_fkey
  foreign key (featured_by) references auth.users(id) on delete set null;

alter table public.community_notes
  drop constraint if exists community_notes_author_id_fkey;
alter table public.community_notes
  add constraint community_notes_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table public.community_notes
  drop constraint if exists community_notes_updated_by_fkey;
alter table public.community_notes
  add constraint community_notes_updated_by_fkey
  foreign key (updated_by) references auth.users(id) on delete set null;

comment on column public.recipe_moderation.moderated_by is
  'Administrator attribution. Set to null if that administrator deletes their account.';
comment on column public.recipe_features.featured_by is
  'Administrator attribution. Set to null if that administrator deletes their account.';
comment on column public.community_notes.author_id is
  'Original administrator attribution. Set to null if that administrator deletes their account.';
comment on column public.community_notes.updated_by is
  'Latest administrator attribution. Set to null if that administrator deletes their account.';
