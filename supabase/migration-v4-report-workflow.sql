-- Add report history, administrator responses and per-user read receipts.

alter table public.recipe_reports
  add column if not exists recipe_title text,
  add column if not exists admin_note text not null default '';

update public.recipe_reports reports
set recipe_title = recipes.title
from public.recipes recipes
where recipes.id = reports.recipe_id
  and reports.recipe_title is null;

alter table public.recipe_reports
  alter column recipe_title set not null,
  alter column recipe_id drop not null;

alter table public.recipe_reports
  drop constraint if exists recipe_reports_recipe_id_fkey;

alter table public.recipe_reports
  add constraint recipe_reports_recipe_id_fkey
  foreign key (recipe_id) references public.recipes(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_reports_recipe_title_length'
      and conrelid = 'public.recipe_reports'::regclass
  ) then
    alter table public.recipe_reports
      add constraint recipe_reports_recipe_title_length
      check (char_length(recipe_title) between 2 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_reports_admin_note_length'
      and conrelid = 'public.recipe_reports'::regclass
  ) then
    alter table public.recipe_reports
      add constraint recipe_reports_admin_note_length
      check (char_length(admin_note) <= 1000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_reports_closed_note_required'
      and conrelid = 'public.recipe_reports'::regclass
  ) then
    alter table public.recipe_reports
      add constraint recipe_reports_closed_note_required
      check (status <> 'closed' or char_length(btrim(admin_note)) >= 3);
  end if;
end $$;

create table if not exists public.recipe_report_receipts (
  report_id bigint primary key references public.recipe_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.recipe_report_receipts enable row level security;

create index if not exists recipe_report_receipts_user_id_idx
  on public.recipe_report_receipts (user_id);

revoke all on table public.recipe_reports from anon, authenticated;
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

revoke all on table public.recipe_report_receipts from anon, authenticated;
grant select on public.recipe_report_receipts to authenticated;
grant insert (report_id, user_id, seen_at) on public.recipe_report_receipts to authenticated;
grant update (seen_at) on public.recipe_report_receipts to authenticated;

drop policy if exists "Users can create their own reports" on public.recipe_reports;
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

comment on table public.recipe_report_receipts is
  'Tracks when a reporter last viewed an administrator update to their report.';
