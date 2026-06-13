-- Asset-management MVP schema.
-- Apply after 20260602000000_initial_schema.sql because this migration uses public.set_updated_at().

create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text not null,
  country text not null,
  market text not null,
  asset_type text not null check (asset_type in ('stock', 'etf')),
  currency text not null,
  is_large_cap boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_stock_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_id uuid not null references public.stocks(id) on delete restrict,
  quantity numeric(18, 6) not null check (quantity > 0),
  average_buy_price numeric(18, 4) not null check (average_buy_price >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stock_id)
);

create table if not exists public.stock_prices (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.stocks(id) on delete cascade,
  price numeric(18, 4) not null check (price >= 0),
  currency text not null,
  change_rate numeric(8, 4),
  fetched_at timestamptz not null default now(),
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_deposit_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deposit_type text not null check (deposit_type in ('deposit', 'installment_savings')),
  asset_name text not null,
  bank_name text,
  currency text not null default 'KRW',
  current_amount numeric(18, 2) not null check (current_amount >= 0),
  monthly_payment numeric(18, 2) check (monthly_payment is null or monthly_payment >= 0),
  interest_rate numeric(8, 4),
  start_date date,
  maturity_date date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_bond_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bond_name text not null,
  issuer text,
  currency text not null default 'KRW',
  principal_amount numeric(18, 2) not null check (principal_amount >= 0),
  current_value numeric(18, 2) not null check (current_value >= 0),
  coupon_rate numeric(8, 4),
  purchase_date date,
  maturity_date date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_categories (
  stock_id uuid not null references public.stocks(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (stock_id, category_id)
);

create index if not exists stocks_symbol_idx on public.stocks(symbol);
create index if not exists stocks_search_idx on public.stocks(country, asset_type, market);
create index if not exists user_stock_assets_user_id_idx on public.user_stock_assets(user_id);
create index if not exists user_stock_assets_stock_id_idx on public.user_stock_assets(stock_id);
create index if not exists stock_prices_stock_id_fetched_at_idx on public.stock_prices(stock_id, fetched_at desc);
create index if not exists user_deposit_assets_user_id_idx on public.user_deposit_assets(user_id);
create index if not exists user_bond_assets_user_id_idx on public.user_bond_assets(user_id);

drop trigger if exists set_stocks_updated_at on public.stocks;
create trigger set_stocks_updated_at
before update on public.stocks
for each row execute function public.set_updated_at();

drop trigger if exists set_user_stock_assets_updated_at on public.user_stock_assets;
create trigger set_user_stock_assets_updated_at
before update on public.user_stock_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_user_deposit_assets_updated_at on public.user_deposit_assets;
create trigger set_user_deposit_assets_updated_at
before update on public.user_deposit_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_user_bond_assets_updated_at on public.user_bond_assets;
create trigger set_user_bond_assets_updated_at
before update on public.user_bond_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

alter table public.stocks enable row level security;
alter table public.user_stock_assets enable row level security;
alter table public.stock_prices enable row level security;
alter table public.user_deposit_assets enable row level security;
alter table public.user_bond_assets enable row level security;
alter table public.categories enable row level security;
alter table public.stock_categories enable row level security;

create policy "stocks_select_authenticated"
on public.stocks for select
to authenticated
using (true);

create policy "categories_select_authenticated"
on public.categories for select
to authenticated
using (true);

create policy "stock_categories_select_authenticated"
on public.stock_categories for select
to authenticated
using (true);

create policy "stock_prices_select_authenticated"
on public.stock_prices for select
to authenticated
using (true);

create policy "user_stock_assets_select_own"
on public.user_stock_assets for select
using (auth.uid() = user_id);

create policy "user_stock_assets_insert_own"
on public.user_stock_assets for insert
with check (auth.uid() = user_id);

create policy "user_stock_assets_update_own"
on public.user_stock_assets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_stock_assets_delete_own"
on public.user_stock_assets for delete
using (auth.uid() = user_id);

create policy "user_deposit_assets_select_own"
on public.user_deposit_assets for select
using (auth.uid() = user_id);

create policy "user_deposit_assets_insert_own"
on public.user_deposit_assets for insert
with check (auth.uid() = user_id);

create policy "user_deposit_assets_update_own"
on public.user_deposit_assets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_deposit_assets_delete_own"
on public.user_deposit_assets for delete
using (auth.uid() = user_id);

create policy "user_bond_assets_select_own"
on public.user_bond_assets for select
using (auth.uid() = user_id);

create policy "user_bond_assets_insert_own"
on public.user_bond_assets for insert
with check (auth.uid() = user_id);

create policy "user_bond_assets_update_own"
on public.user_bond_assets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_bond_assets_delete_own"
on public.user_bond_assets for delete
using (auth.uid() = user_id);

insert into public.categories (name, description)
values
  ('기술주', '기술 섹터 주식'),
  ('반도체', '반도체 및 장비'),
  ('자동차/2차전지', '자동차, 배터리, 2차전지'),
  ('금융', '은행, 보험, 증권 등 금융'),
  ('헬스케어', '바이오, 제약, 헬스케어'),
  ('플랫폼/인터넷', '인터넷 플랫폼과 커뮤니케이션'),
  ('소비재', '필수소비재와 경기소비재'),
  ('에너지', '에너지 및 소재'),
  ('성장주', '성장 성격 자산'),
  ('배당', '배당 성격 자산'),
  ('방어주', '방어적 성격 자산'),
  ('지수추종', '시장 지수 추종 ETF'),
  ('채권형 ETF', '채권형 상장지수펀드'),
  ('금 ETF', '금 관련 상장지수펀드'),
  ('원자재', '원자재 관련 자산'),
  ('리츠', '부동산 투자신탁')
on conflict (name) do update
set description = excluded.description;
