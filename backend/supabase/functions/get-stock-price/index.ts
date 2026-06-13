import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchPrice } from "./priceProvider.ts";

type RequestBody = {
  stock_id?: string;
  stock_ids?: string[];
};

type StockRow = {
  id: string;
  symbol: string;
  currency: string;
};

type PriceRow = {
  stock_id: string;
  price: number;
  currency: string;
  change_rate: number | null;
  fetched_at: string;
  source: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as RequestBody;
    const stockIds = [...new Set([...(body.stock_ids ?? []), body.stock_id].filter(Boolean))] as string[];

    if (stockIds.length === 0) {
      return json({ error: "stock_id 또는 stock_ids가 필요합니다." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: request.headers.get("Authorization") ?? "",
          },
        },
      },
    );

    const { data: stocks, error: stockError } = await supabase
      .from("stocks")
      .select("id, symbol, currency")
      .in("id", stockIds);

    if (stockError) throw stockError;

    const prices = await Promise.all((stocks ?? []).map((stock: StockRow) => getCachedOrFreshPrice(supabase, stock)));

    return json({ prices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격 조회에 실패했습니다.";
    return json({ error: message }, 500);
  }
});

async function getCachedOrFreshPrice(supabase: ReturnType<typeof createClient>, stock: StockRow): Promise<PriceRow> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: cached, error: cacheError } = await supabase
    .from("stock_prices")
    .select("stock_id, price, currency, change_rate, fetched_at, source")
    .eq("stock_id", stock.id)
    .gte("fetched_at", todayStart.toISOString())
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheError) throw cacheError;
  if (cached) return cached as PriceRow;

  const fetched = await fetchPrice({
    symbol: stock.symbol,
    currency: stock.currency,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("stock_prices")
    .insert({
      stock_id: stock.id,
      price: fetched.price,
      currency: fetched.currency,
      change_rate: fetched.changeRate,
      source: fetched.source,
    })
    .select("stock_id, price, currency, change_rate, fetched_at, source")
    .single();

  if (insertError) throw insertError;
  return inserted as PriceRow;
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

