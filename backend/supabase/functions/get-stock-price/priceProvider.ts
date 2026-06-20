export type PriceProviderInput = { symbol: string; currency: string };
export type PriceProviderResult = {
  price: number;
  currency: string;
  changeRate: number | null;
  source: string;
};

const NAVER_PRICE_CACHE_TTL_MS = 2 * 60 * 1000;
const NAVER_FETCH_TIMEOUT_MS = 5 * 1000;

const priceCache = new Map<string, { data: PriceProviderResult; timestamp: number }>();

export async function fetchPrice(
  input: PriceProviderInput,
): Promise<PriceProviderResult> {
  const domesticCode = getDomesticStockCode(input.symbol);

  if (!domesticCode) {
    return getMockResult(input, "mock");
  }

  const cached = priceCache.get(domesticCode);
  if (cached && Date.now() - cached.timestamp < NAVER_PRICE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const data = await fetchNaverPrice(domesticCode);
    priceCache.set(domesticCode, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Failed to fetch Naver stock price for ${domesticCode}`, error);
    return getMockResult({ ...input, currency: "KRW" }, "mock-fallback");
  }
}

function getDomesticStockCode(symbol: string): string | null {
  const match = symbol.trim().toUpperCase().match(/^(\d{6})\.KS$/);
  return match?.[1] ?? null;
}

async function fetchNaverPrice(code: string): Promise<PriceProviderResult> {
  const realtimeResult = await fetchNaverRealtimePrice(code);
  if (realtimeResult) {
    return realtimeResult;
  }

  const htmlResult = await fetchNaverHtmlPrice(code);
  if (htmlResult) {
    return htmlResult;
  }

  throw new Error("Naver price response did not contain parseable price data");
}

async function fetchNaverRealtimePrice(
  code: string,
): Promise<PriceProviderResult | null> {
  const url =
    `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
  const response = await fetchWithTimeout(url, {
    headers: getNaverHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Naver realtime request failed with ${response.status}`);
  }

  const payload = await response.json();
  const item = payload?.result?.areas?.[0]?.datas?.[0];
  const price = parseNumber(item?.nv);
  const changeRate = parseNumber(item?.cr);

  if (price === null) {
    return null;
  }

  return {
    price,
    currency: "KRW",
    changeRate,
    source: "naver",
  };
}

async function fetchNaverHtmlPrice(
  code: string,
): Promise<PriceProviderResult | null> {
  const url = `https://finance.naver.com/item/main.naver?code=${code}`;
  const response = await fetchWithTimeout(url, {
    headers: getNaverHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Naver HTML request failed with ${response.status}`);
  }

  const html = await response.text();
  const price = parseHtmlCurrentPrice(html);
  const changeRate = parseHtmlChangeRate(html);

  if (price === null) {
    return null;
  }

  return {
    price,
    currency: "KRW",
    changeRate,
    source: "naver",
  };
}

function parseHtmlCurrentPrice(html: string): number | null {
  const match = html.match(
    /<p[^>]*class=["']no_today["'][^>]*>[\s\S]*?<span[^>]*class=["']blind["'][^>]*>([^<]+)<\/span>/i,
  );
  return parseNumber(match?.[1]);
}

function parseHtmlChangeRate(html: string): number | null {
  const rateAreaMatch = html.match(
    /<p[^>]*class=["']no_exday["'][^>]*>([\s\S]*?)<\/p>/i,
  );
  const rateArea = rateAreaMatch?.[1] ?? "";
  const blindMatches = [...rateArea.matchAll(
    /<span[^>]*class=["']blind["'][^>]*>([^<]+)<\/span>/gi,
  )].map((match) => match[1]);
  const rateText = blindMatches.find((value) => value.includes("%"));
  const rate = parseNumber(rateText);

  if (rate === null) {
    return null;
  }

  if (rateArea.includes("no_down") || rateArea.includes("하락")) {
    return -Math.abs(rate);
  }

  return rate;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const numberMatch = value.replace(/,/g, "").match(/[+-]?\d+(?:\.\d+)?/);
  if (!numberMatch) {
    return null;
  }

  const parsed = Number(numberMatch[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NAVER_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getNaverHeaders(): HeadersInit {
  return {
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://finance.naver.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  };
}

function getMockResult(
  input: PriceProviderInput,
  source: "mock" | "mock-fallback",
): PriceProviderResult {
  return {
    price: getMockPrice(input.symbol),
    currency: input.currency,
    changeRate: getMockChangeRate(input.symbol),
    source,
  };
}

function getMockPrice(symbol: string): number {
  const knownPrices: Record<string, number> = {
    AAPL: 195.64,
    MSFT: 430.16,
    SPY: 547.23,
    QQQ: 479.11,
    "005930.KS": 73000,
  };

  return knownPrices[symbol.trim().toUpperCase()] ?? 100;
}

function getMockChangeRate(symbol: string): number {
  const knownChangeRates: Record<string, number> = {
    AAPL: 0.82,
    MSFT: -0.31,
    SPY: 0.18,
    QQQ: 0.44,
    "005930.KS": 1.12,
  };

  return knownChangeRates[symbol.trim().toUpperCase()] ?? 0;
}
