export type PriceProviderInput = {
  symbol: string;
  currency: string;
};

export type PriceProviderResult = {
  price: number;
  currency: string;
  changeRate: number | null;
  source: string;
};

export async function fetchPrice(input: PriceProviderInput): Promise<PriceProviderResult> {
  // Mock-first provider.
  // Keep this function as the single switch point when replacing mock prices
  // with Twelve Data or EODHD. Store API keys in Supabase Secrets, never in React.
  return {
    price: getMockPrice(input.symbol),
    currency: input.currency,
    changeRate: getMockChangeRate(input.symbol),
    source: "mock",
  };
}

function getMockPrice(symbol: string) {
  const knownPrices: Record<string, number> = {
    "005930.KS": 73000,
    "000660.KS": 220000,
    AAPL: 196,
    MSFT: 480,
    SPY: 590,
    QQQ: 520,
  };

  if (knownPrices[symbol] != null) return knownPrices[symbol];

  const hash = Array.from(symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Math.round((50 + (hash % 500)) * 100) / 100;
}

function getMockChangeRate(symbol: string) {
  const hash = Array.from(symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Math.round((((hash % 800) - 400) / 100) * 100) / 100;
}
