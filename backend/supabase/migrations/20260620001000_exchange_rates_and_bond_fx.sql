create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18, 6) not null check (rate > 0),
  rate_date date not null,
  source text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (base_currency, quote_currency, rate_date)
);

alter table public.user_bond_assets
add column if not exists purchase_fx_rate numeric(18, 6) check (purchase_fx_rate is null or purchase_fx_rate > 0);

create index if not exists exchange_rates_pair_date_idx
on public.exchange_rates(base_currency, quote_currency, rate_date desc);

alter table public.exchange_rates enable row level security;

create policy "exchange_rates_select_authenticated"
on public.exchange_rates for select
to authenticated
using (true);
