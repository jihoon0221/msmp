# Supabase Setup

This directory contains the Supabase database foundation for the asset-management MVP.

## Current Official Asset Tables

The current frontend uses these tables:

- `stocks`
- `stock_prices`
- `exchange_rates`
- `user_stock_assets`
- `user_deposit_assets`
- `user_bond_assets`
- `categories`
- `stock_categories`

The older `user_holdings` table exists in the initial schema for compatibility with earlier prototypes, but the current app does not use it.

## Apply Order

Apply migrations in filename order:

1. `migrations/20260602000000_initial_schema.sql`
2. `migrations/20260613000000_asset_management_mvp.sql`
3. `migrations/20260620000000_allow_other_goal_type.sql`
4. `migrations/20260620001000_exchange_rates_and_bond_fx.sql`

The second migration depends on `public.set_updated_at()` from the initial migration.

## Supabase CLI Flow

The Supabase CLI is not vendored in this repository. Install and authenticate it locally, then run from `backend`:

```bash
supabase init
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy get-stock-price
supabase functions deploy get-exchange-rate
```

If `supabase init` creates a new `supabase/config.toml`, keep the existing `supabase/migrations`, `supabase/functions`, and `supabase/seed` directories.

## Seed Stocks

Import `seed/stocks_seed_400.csv` into `public.stocks`.

Recommended approach for MVP testing:

1. Open Supabase Studio.
2. Go to Table Editor.
3. Open `stocks`.
4. Import CSV.
5. Select `seed/stocks_seed_400.csv`.
6. Upsert using `symbol` as the conflict key when re-importing.

The CSV contains 400 seed stocks/ETFs plus the header row.

## Required Settings Before Frontend Test

In Supabase:

- Enable Email provider in Authentication.
- Apply the migrations above.
- Import `stocks_seed_400.csv`.
- Deploy `get-stock-price` and `get-exchange-rate`.

In `frontend/.env.local`:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Market-data API keys are not needed for the current mock price phase. USD/KRW exchange rates use Frankfurter without an API key.
