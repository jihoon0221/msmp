create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  investor_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('jeonse', 'seed', 'car', 'wedding')),
  target_amount numeric(14, 2) not null check (target_amount >= 0),
  current_assets numeric(14, 2) not null default 0 check (current_assets >= 0),
  monthly_salary numeric(14, 2) not null default 0 check (monthly_salary >= 0),
  monthly_spend numeric(14, 2) not null default 0 check (monthly_spend >= 0),
  years integer not null check (years between 1 and 50),
  risk_profile text not null check (risk_profile in ('stable', 'neutral', 'aggressive')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.financial_goals(id) on delete cascade,
  expected_return_pct numeric(5, 2) not null,
  volatility_pct numeric(5, 2),
  rebalance_cycle_months integer not null check (rebalance_cycle_months between 1 and 24),
  allocation jsonb not null default '[]'::jsonb,
  rationale jsonb not null default '{}'::jsonb,
  simulation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mydata_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  account_type text not null,
  masked_account_no text,
  balance numeric(14, 2) not null default 0,
  consented_at timestamptz,
  consent_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.mydata_accounts(id) on delete set null,
  occurred_at timestamptz not null,
  title text not null,
  category text,
  amount numeric(14, 2) not null,
  direction text not null check (direction in ('inflow', 'outflow')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_goals_user_id_idx on public.financial_goals(user_id);
create index if not exists portfolio_plans_user_id_idx on public.portfolio_plans(user_id);
create index if not exists portfolio_plans_goal_id_idx on public.portfolio_plans(goal_id);
create index if not exists mydata_accounts_user_id_idx on public.mydata_accounts(user_id);
create index if not exists transactions_user_id_occurred_at_idx on public.transactions(user_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_financial_goals_updated_at on public.financial_goals;
create trigger set_financial_goals_updated_at
before update on public.financial_goals
for each row execute function public.set_updated_at();

drop trigger if exists set_mydata_accounts_updated_at on public.mydata_accounts;
create trigger set_mydata_accounts_updated_at
before update on public.mydata_accounts
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.financial_goals enable row level security;
alter table public.portfolio_plans enable row level security;
alter table public.mydata_accounts enable row level security;
alter table public.transactions enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "financial_goals_select_own"
on public.financial_goals for select
using (auth.uid() = user_id);

create policy "financial_goals_insert_own"
on public.financial_goals for insert
with check (auth.uid() = user_id);

create policy "financial_goals_update_own"
on public.financial_goals for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "financial_goals_delete_own"
on public.financial_goals for delete
using (auth.uid() = user_id);

create policy "portfolio_plans_select_own"
on public.portfolio_plans for select
using (auth.uid() = user_id);

create policy "portfolio_plans_insert_own"
on public.portfolio_plans for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.financial_goals goals
    where goals.id = goal_id
      and goals.user_id = auth.uid()
  )
);

create policy "portfolio_plans_delete_own"
on public.portfolio_plans for delete
using (auth.uid() = user_id);

create policy "mydata_accounts_select_own"
on public.mydata_accounts for select
using (auth.uid() = user_id);

create policy "mydata_accounts_insert_own"
on public.mydata_accounts for insert
with check (auth.uid() = user_id);

create policy "mydata_accounts_update_own"
on public.mydata_accounts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "mydata_accounts_delete_own"
on public.mydata_accounts for delete
using (auth.uid() = user_id);

create policy "transactions_select_own"
on public.transactions for select
using (auth.uid() = user_id);

create policy "transactions_insert_own"
on public.transactions for insert
with check (auth.uid() = user_id);

create policy "transactions_delete_own"
on public.transactions for delete
using (auth.uid() = user_id);

