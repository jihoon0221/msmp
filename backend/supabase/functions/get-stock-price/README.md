# get-stock-price

Supabase Edge Function for stock/ETF price refresh.

## Current Strategy

This function intentionally uses mock prices first so the full asset-management flow can be completed without a market-data API key.

Flow:

1. Receive `stock_id` or `stock_ids`.
2. Read symbols from `public.stocks`.
3. Return today's cached `public.stock_prices` row if it exists.
4. Otherwise generate a deterministic mock price in `priceProvider.ts`.
5. Insert the price into `public.stock_prices` with `source = "mock"`.

## Later Real Provider Switch

Keep the frontend and DB contract unchanged. Replace only `fetchPrice()` in `priceProvider.ts`.

Suggested Supabase Secrets when switching:

```bash
supabase secrets set MARKET_PRICE_PROVIDER=twelve_data
supabase secrets set TWELVE_DATA_API_KEY=<key>
```

or:

```bash
supabase secrets set MARKET_PRICE_PROVIDER=eodhd
supabase secrets set EODHD_API_KEY=<key>
```

`fetchPrice()` must continue to return:

```ts
{
  price: number;
  currency: string;
  changeRate: number | null;
  source: string;
}
```
