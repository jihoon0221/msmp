create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age integer check (age is null or age >= 0),
  life_stage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null default '🎯',
  title text not null,
  target_amount numeric not null check (target_amount >= 0),
  saved_amount numeric not null default 0 check (saved_amount >= 0),
  months integer not null check (months > 0),
  priority text not null check (priority in ('높음', '보통', '낮음')),
  goal_type text check (goal_type in ('emergency', 'short', 'mid', 'long', 'ultraLong')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.goals enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read their own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on public.goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own goals"
  on public.goals for delete
  using (auth.uid() = user_id);
