import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  base_currency?: string;
  quote_currency?: string;
  rate_date?: string;
};

type FrankfurterRateResponse = {
  date: string;
  base: string;
  quote: string;
  rate: number;
  message?: string;
};

const SUPPORTED_BASE_CURRENCIES = new Set(["USD", "KRW"]);
const DEFAULT_BASE_CURRENCY = "USD";
const DEFAULT_QUOTE_CURRENCY = "KRW";
const SOURCE = "frankfurter";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LATEST_RATE_MAX_AGE_DAYS = 7;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const baseCurrency = normalizeCurrency(body.base_currency ?? DEFAULT_BASE_CURRENCY);
    const quoteCurrency = normalizeCurrency(body.quote_currency ?? DEFAULT_QUOTE_CURRENCY);
    const requestedRateDate = normalizeRateDate(body.rate_date);

    if (quoteCurrency !== DEFAULT_QUOTE_CURRENCY) {
      return json({ error: "현재는 KRW 기준 환율만 지원합니다." }, 400);
    }

    if (!SUPPORTED_BASE_CURRENCIES.has(baseCurrency)) {
      return json({ error: "현재는 USD 또는 KRW만 지원합니다." }, 400);
    }

    if (baseCurrency === quoteCurrency) {
      return json({
        rate: {
          base_currency: baseCurrency,
          quote_currency: quoteCurrency,
          rate: 1,
          rate_date: requestedRateDate ?? new Date().toISOString().slice(0, 10),
          source: "identity",
          fetched_at: new Date().toISOString(),
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const staleBefore = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const oldestLatestRateDate = toDateString(Date.now() - LATEST_RATE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    let cacheQuery = supabase
      .from("exchange_rates")
      .select("base_currency, quote_currency, rate, rate_date, source, fetched_at")
      .eq("base_currency", baseCurrency)
      .eq("quote_currency", quoteCurrency)
      .eq("source", SOURCE);

    if (requestedRateDate) {
      cacheQuery = cacheQuery.eq("rate_date", requestedRateDate);
    } else {
      cacheQuery = cacheQuery
        .gte("rate_date", oldestLatestRateDate)
        .gte("fetched_at", staleBefore)
        .order("rate_date", { ascending: false })
        .order("fetched_at", { ascending: false })
        .limit(1);
    }

    const { data: cached, error: cacheError } = await cacheQuery.maybeSingle();

    if (cacheError) throw cacheError;
    if (cached) return json({ rate: cached });

    const fetched = await fetchExchangeRate(baseCurrency, quoteCurrency, requestedRateDate);
    const { data: upserted, error: upsertError } = await supabase
      .from("exchange_rates")
      .upsert(
        {
          base_currency: baseCurrency,
          quote_currency: quoteCurrency,
          rate: fetched.rate,
          rate_date: fetched.rateDate,
          source: SOURCE,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "base_currency,quote_currency,rate_date" },
      )
      .select("base_currency, quote_currency, rate, rate_date, source, fetched_at")
      .single();

    if (upsertError) throw upsertError;

    return json({ rate: upserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "환율 조회에 실패했습니다.";
    return json({ error: message }, 500);
  }
});

function normalizeCurrency(currency: string) {
  return currency.trim().toUpperCase();
}

function toDateString(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeRateDate(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("환율 기준일 형식은 YYYY-MM-DD이어야 합니다.");
  }

  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("환율 기준일이 올바르지 않습니다.");
  }

  return trimmed;
}

async function fetchExchangeRate(baseCurrency: string, quoteCurrency: string, rateDate: string | null) {
  const url = new URL(`https://api.frankfurter.dev/v2/rate/${baseCurrency}/${quoteCurrency}`);
  if (rateDate) url.searchParams.set("date", rateDate);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`환율 API 요청 실패 (${response.status})`);
  }

  const data = (await response.json()) as FrankfurterRateResponse;
  if (!data.rate || data.base !== baseCurrency || data.quote !== quoteCurrency) {
    throw new Error(data.message ?? "환율 API 응답이 올바르지 않습니다.");
  }

  return {
    rate: data.rate,
    rateDate: data.date,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
