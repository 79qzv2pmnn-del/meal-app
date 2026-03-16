create table if not exists public.mealapp_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  meals jsonb not null default '[]'::jsonb,
  recipes jsonb not null default '[]'::jsonb,
  recipe_sets jsonb not null default '[]'::jsonb,
  goals jsonb not null default '{"calories":2500,"protein":150,"fat":70,"carbs":300}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mealapp_data enable row level security;

create policy "mealapp_select_own"
on public.mealapp_data
for select
to authenticated
using (auth.uid() = user_id);

create policy "mealapp_insert_own"
on public.mealapp_data
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "mealapp_update_own"
on public.mealapp_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
