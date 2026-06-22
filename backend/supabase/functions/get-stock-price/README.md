# get-stock-price

Supabase Edge Function for stock/ETF price refresh.

## Current Strategy

This function uses Naver Finance for domestic `.KS` symbols and deterministic mock prices for non-domestic symbols or provider failures.

Flow:

1. Receive `stock_id` or `stock_ids`.
2. Read symbols from `public.stocks`.
3. Return today's cached `public.stock_prices` row if it exists.
4. For domestic `.KS` symbols, try Naver realtime data and then Naver HTML.
5. Use deterministic mock data for non-domestic symbols or as a Naver fallback.
6. Insert the result into `public.stock_prices` with `source = "naver"`, `"mock"`, or `"mock-fallback"`.

## Overseas Provider Switch

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
