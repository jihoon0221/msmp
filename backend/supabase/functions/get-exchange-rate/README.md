# get-exchange-rate

Supabase Edge Function for USD/KRW exchange-rate refresh and historical lookup.

## Current Strategy

This function uses Frankfurter because it requires no API key and supports both latest and historical daily exchange rates.

Flow:

1. Receive `base_currency`, `quote_currency`, and optional `rate_date`.
2. Support `USD` to `KRW`; `KRW` to `KRW` returns an identity rate.
3. For a historical `rate_date`, return that cached `public.exchange_rates` row if it exists.
4. For latest rates, return a cached row only if it was fetched within the last 24 hours and its `rate_date` is recent.
5. Otherwise call `https://api.frankfurter.dev/v2/rate/USD/KRW`.
6. Store the `KRW` rate in `public.exchange_rates` with `source = "frankfurter"`.

The frontend uses this only for direct USD bond valuation. Stock/ETF prices remain in their native quote currency at this stage.

## Deploy

```bash
supabase functions deploy get-exchange-rate
```

No provider API key is required. The function still needs the standard Supabase Edge Function environment values so it can write to `exchange_rates`.
