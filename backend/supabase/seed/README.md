# Seed Data

`stocks_seed_400.csv` contains the initial stock/ETF universe for the asset-management MVP.

Import it into `public.stocks` with Supabase Studio CSV import or an equivalent admin script.
Use `symbol` as the upsert conflict key when re-importing.

After importing, the app can search these rows immediately. Price refresh does not require a real market-data API key in the current phase because `get-stock-price` uses deterministic mock prices.

The file is UTF-8 without BOM and contains 400 rows plus the header.
