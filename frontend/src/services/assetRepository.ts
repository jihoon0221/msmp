import { supabase } from "../lib/supabase";
import type {
  AssetPortfolio,
  BondAsset,
  DepositAsset,
  Stock,
  StockAsset,
  StockAssetFilter,
} from "../types/domain";

type StockRow = {
  id: string;
  symbol: string;
  name: string;
  country: string;
  market: string;
  asset_type: "stock" | "etf";
  currency: string;
  is_large_cap: boolean;
};

type StockAssetRow = {
  id: string;
  stock_id: string;
  quantity: number | string;
  average_buy_price: number | string;
  memo: string | null;
  stocks: StockRow | null;
};

type StockPriceRow = {
  stock_id: string;
  price: number | string;
  change_rate: number | string | null;
  fetched_at: string;
};

type DepositAssetRow = {
  id: string;
  deposit_type: "deposit" | "installment_savings";
  asset_name: string;
  bank_name: string | null;
  currency: string;
  current_amount: number | string;
  monthly_payment: number | string | null;
  interest_rate: number | string | null;
  start_date: string | null;
  maturity_date: string | null;
  memo: string | null;
};

type BondAssetRow = {
  id: string;
  bond_name: string;
  issuer: string | null;
  currency: string;
  principal_amount: number | string;
  current_value: number | string;
  coupon_rate: number | string | null;
  purchase_fx_rate: number | string | null;
  purchase_date: string | null;
  maturity_date: string | null;
  memo: string | null;
};

type ExchangeRateRow = {
  base_currency: string;
  quote_currency: string;
  rate: number | string;
  rate_date: string;
  fetched_at: string;
};

type ExchangeRateResponse = {
  rate?: ExchangeRateRow;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STOCK_PRICE_REFRESH_TTL_MS = DAY_MS;
const EXCHANGE_RATE_REFRESH_TTL_MS = DAY_MS;
const LATEST_RATE_MAX_AGE_DAYS = 7;

export type StockAssetInput = {
  stockId: string;
  quantity: number;
  averageBuyPrice: number;
  memo?: string;
};

export type DepositAssetInput = {
  depositType: "deposit" | "installment_savings";
  assetName: string;
  bankName?: string;
  currentAmount: number;
  monthlyPayment?: number;
  interestRate?: number;
  startDate?: string;
  maturityDate?: string;
  memo?: string;
};

export type BondAssetInput = {
  bondName: string;
  issuer?: string;
  currency: string;
  principalAmount: number;
  couponRate?: number;
  purchaseDate?: string;
  maturityDate?: string;
  memo?: string;
};

export class AssetRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetRepositoryError";
  }
}

export async function searchStocks(query: string, filter: StockAssetFilter): Promise<Stock[]> {
  const client = requireSupabaseClient();
  let request = client
    .from("stocks")
    .select("id, symbol, name, country, market, asset_type, currency, is_large_cap")
    .order("name")
    .limit(25);

  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    request = request.or(`name.ilike.%${normalizedQuery}%,symbol.ilike.%${normalizedQuery}%`);
  }

  if (filter === "kr_stock") request = request.eq("country", "KR").eq("asset_type", "stock");
  if (filter === "us_stock") request = request.eq("country", "US").eq("asset_type", "stock");
  if (filter === "kr_etf") request = request.eq("country", "KR").eq("asset_type", "etf");
  if (filter === "us_etf") request = request.eq("country", "US").eq("asset_type", "etf");

  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as StockRow[]).map(mapStockRow);
}

export async function listAssetPortfolio(): Promise<AssetPortfolio> {
  const client = requireSupabaseClient();
  await requireUserId();

  const [{ data: stockRows, error: stockError }, { data: depositRows, error: depositError }, { data: bondRows, error: bondError }] =
    await Promise.all([
      client
        .from("user_stock_assets")
        .select("id, stock_id, quantity, average_buy_price, memo, stocks(id, symbol, name, country, market, asset_type, currency, is_large_cap)")
        .order("created_at", { ascending: false }),
      client
        .from("user_deposit_assets")
        .select("id, deposit_type, asset_name, bank_name, currency, current_amount, monthly_payment, interest_rate, start_date, maturity_date, memo")
        .order("created_at", { ascending: false }),
      client
        .from("user_bond_assets")
        .select("id, bond_name, issuer, currency, principal_amount, current_value, coupon_rate, purchase_fx_rate, purchase_date, maturity_date, memo")
        .order("created_at", { ascending: false }),
    ]);

  if (stockError) throw stockError;
  if (depositError) throw depositError;
  if (bondError) throw bondError;

  const typedStockRows = (stockRows ?? []) as unknown as StockAssetRow[];
  const typedBondRows = (bondRows ?? []) as BondAssetRow[];
  const stockIds = uniqueValues(typedStockRows.map((row) => row.stock_id));
  const bondRowsWithPurchaseRates = await backfillMissingBondPurchaseFxRates(typedBondRows);
  const exchangeRateCurrencies = filterExchangeRateCurrencies([
    ...typedStockRows.map((row) => row.stocks?.currency ?? ""),
    ...bondRowsWithPurchaseRates.map((row) => row.currency),
  ]);

  let latestPrices = await getLatestStockPrices(stockIds);
  const staleStockIds = stockIds.filter((stockId) => !isFreshTimestamp(latestPrices.get(stockId)?.fetched_at, STOCK_PRICE_REFRESH_TTL_MS));
  if (staleStockIds.length > 0) {
    await refreshStockPrices(staleStockIds);
    latestPrices = await getLatestStockPrices(stockIds);
  }

  let latestExchangeRates = await getLatestExchangeRates(exchangeRateCurrencies);
  const staleRateCurrencies = exchangeRateCurrencies.filter(
    (currency) => !isFreshTimestamp(latestExchangeRates.get(currency)?.fetched_at, EXCHANGE_RATE_REFRESH_TTL_MS),
  );
  if (staleRateCurrencies.length > 0) {
    await refreshExchangeRates(staleRateCurrencies);
    latestExchangeRates = await getLatestExchangeRates(exchangeRateCurrencies);
  }

  return {
    stockAssets: typedStockRows.map((row) =>
      mapStockAssetRow(row, latestPrices.get(row.stock_id), latestExchangeRates.get(row.stocks?.currency ?? "")),
    ),
    depositAssets: ((depositRows ?? []) as DepositAssetRow[]).map(mapDepositAssetRow),
    bondAssets: bondRowsWithPurchaseRates.map((row) => mapBondAssetRow(row, latestExchangeRates.get(row.currency))),
  };
}

export async function upsertStockAsset(input: StockAssetInput) {
  const client = requireSupabaseClient();
  const userId = await requireUserId();

  const { error } = await client.from("user_stock_assets").upsert(
    {
      user_id: userId,
      stock_id: input.stockId,
      quantity: input.quantity,
      average_buy_price: input.averageBuyPrice,
      memo: emptyToNull(input.memo),
    },
    { onConflict: "user_id,stock_id" },
  );

  if (error) throw error;
}

export async function updateStockAsset(id: string, input: StockAssetInput) {
  const client = requireSupabaseClient();
  await requireUserId();

  const { error } = await client
    .from("user_stock_assets")
    .update({
      stock_id: input.stockId,
      quantity: input.quantity,
      average_buy_price: input.averageBuyPrice,
      memo: emptyToNull(input.memo),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function createDepositAsset(input: DepositAssetInput) {
  const client = requireSupabaseClient();
  const userId = await requireUserId();

  const { error } = await client.from("user_deposit_assets").insert({
    user_id: userId,
    deposit_type: input.depositType,
    asset_name: input.assetName,
    bank_name: emptyToNull(input.bankName),
    current_amount: input.currentAmount,
    monthly_payment: input.depositType === "installment_savings" ? input.monthlyPayment ?? null : null,
    interest_rate: input.interestRate ?? null,
    start_date: emptyToNull(input.startDate),
    maturity_date: emptyToNull(input.maturityDate),
    memo: emptyToNull(input.memo),
  });

  if (error) throw error;
}

export async function updateDepositAsset(id: string, input: DepositAssetInput) {
  const client = requireSupabaseClient();
  await requireUserId();

  const { error } = await client
    .from("user_deposit_assets")
    .update({
      deposit_type: input.depositType,
      asset_name: input.assetName,
      bank_name: emptyToNull(input.bankName),
      current_amount: input.currentAmount,
      monthly_payment: input.depositType === "installment_savings" ? input.monthlyPayment ?? null : null,
      interest_rate: input.interestRate ?? null,
      start_date: emptyToNull(input.startDate),
      maturity_date: emptyToNull(input.maturityDate),
      memo: emptyToNull(input.memo),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function createBondAsset(input: BondAssetInput) {
  const client = requireSupabaseClient();
  const userId = await requireUserId();
  const purchaseFxRate = await resolveBondPurchaseFxRate(input);

  const { error } = await client.from("user_bond_assets").insert({
    user_id: userId,
    bond_name: input.bondName,
    issuer: emptyToNull(input.issuer),
    currency: input.currency,
    principal_amount: input.principalAmount,
    current_value: input.principalAmount,
    coupon_rate: input.couponRate ?? null,
    purchase_fx_rate: purchaseFxRate,
    purchase_date: emptyToNull(input.purchaseDate),
    maturity_date: emptyToNull(input.maturityDate),
    memo: emptyToNull(input.memo),
  });

  if (error) throw error;
}

export async function updateBondAsset(id: string, input: BondAssetInput) {
  const client = requireSupabaseClient();
  await requireUserId();
  const purchaseFxRate = await resolveBondPurchaseFxRate(input);

  const { error } = await client
    .from("user_bond_assets")
    .update({
      bond_name: input.bondName,
      issuer: emptyToNull(input.issuer),
      currency: input.currency,
      principal_amount: input.principalAmount,
      current_value: input.principalAmount,
      coupon_rate: input.couponRate ?? null,
      purchase_fx_rate: purchaseFxRate,
      purchase_date: emptyToNull(input.purchaseDate),
      maturity_date: emptyToNull(input.maturityDate),
      memo: emptyToNull(input.memo),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteAsset(assetType: "stock" | "deposit" | "bond", id: string) {
  const client = requireSupabaseClient();
  const table = {
    stock: "user_stock_assets",
    deposit: "user_deposit_assets",
    bond: "user_bond_assets",
  }[assetType];

  const { error } = await client.from(table).delete().eq("id", id);
  if (error) throw error;
}

async function refreshStockPrices(stockIds: string[]) {
  const client = requireSupabaseClient();
  const targetStockIds = uniqueValues(stockIds);
  if (targetStockIds.length === 0) return;

  const headers = await getAuthHeaders();
  const { error } = await client.functions.invoke("get-stock-price", {
    headers,
    body: {
      stock_ids: targetStockIds,
    },
  });

  if (error) {
    console.warn("Failed to refresh stock prices", error);
  }
}

async function refreshExchangeRates(currencies: string[]) {
  const targetCurrencies = filterExchangeRateCurrencies(currencies);
  if (targetCurrencies.length === 0) return;

  await Promise.all(
    targetCurrencies.map(async (currency) => {
      try {
        await invokeExchangeRate(currency, "KRW");
      } catch (error) {
        console.warn("Failed to refresh exchange rate", currency, error);
      }
    }),
  );
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new AssetRepositoryError("Supabase 환경변수가 설정되지 않았습니다.");
  }
  return supabase;
}

async function requireUserId() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) throw error;
  if (!data.session?.user) throw new AssetRepositoryError("로그인 후 보유자산을 관리할 수 있습니다.");
  return data.session.user.id;
}

async function getLatestStockPrices(stockIds: string[]) {
  const client = requireSupabaseClient();
  const latestPrices = new Map<string, StockPriceRow>();
  if (stockIds.length === 0) return latestPrices;

  const { data, error } = await client
    .from("stock_prices")
    .select("stock_id, price, change_rate, fetched_at")
    .in("stock_id", stockIds)
    .order("fetched_at", { ascending: false });

  if (error) throw error;

  for (const row of (data ?? []) as StockPriceRow[]) {
    if (!latestPrices.has(row.stock_id)) latestPrices.set(row.stock_id, row);
  }

  return latestPrices;
}

async function getLatestExchangeRates(currencies: string[]) {
  const client = requireSupabaseClient();
  const latestRates = new Map<string, ExchangeRateRow>();
  const targetCurrencies = filterExchangeRateCurrencies(currencies);
  if (targetCurrencies.length === 0) return latestRates;

  const oldestLatestRateDate = toDateString(Date.now() - LATEST_RATE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await client
    .from("exchange_rates")
    .select("base_currency, quote_currency, rate, rate_date, fetched_at")
    .in("base_currency", targetCurrencies)
    .eq("quote_currency", "KRW")
    .eq("source", "frankfurter")
    .gte("rate_date", oldestLatestRateDate)
    .order("rate_date", { ascending: false })
    .order("fetched_at", { ascending: false });

  if (error) throw error;

  for (const row of (data ?? []) as ExchangeRateRow[]) {
    if (!latestRates.has(row.base_currency)) latestRates.set(row.base_currency, row);
  }

  return latestRates;
}

async function backfillMissingBondPurchaseFxRates(rows: BondAssetRow[]) {
  const client = requireSupabaseClient();

  return Promise.all(
    rows.map(async (row) => {
      if (row.currency !== "USD" || row.purchase_fx_rate != null || !row.purchase_date) return row;

      try {
        const rate = await invokeExchangeRate(row.currency, "KRW", row.purchase_date);
        const purchaseFxRate = Number(rate.rate);
        const { error } = await client
          .from("user_bond_assets")
          .update({ purchase_fx_rate: purchaseFxRate })
          .eq("id", row.id);

        if (error) throw error;
        return { ...row, purchase_fx_rate: purchaseFxRate };
      } catch (error) {
        console.warn("Failed to backfill bond purchase exchange rate", row.id, error);
        return row;
      }
    }),
  );
}

function filterExchangeRateCurrencies(currencies: string[]) {
  return uniqueValues(currencies.filter((currency) => currency === "USD"));
}

async function resolveBondPurchaseFxRate(input: BondAssetInput) {
  if (input.currency === "KRW") return null;
  if (input.currency !== "USD") throw new AssetRepositoryError("현재 USD 채권만 지원합니다.");
  if (!input.purchaseDate) throw new AssetRepositoryError("USD 채권은 매수일이 필요합니다.");

  const rate = await invokeExchangeRate(input.currency, "KRW", input.purchaseDate);
  return Number(rate.rate);
}

async function invokeExchangeRate(baseCurrency: string, quoteCurrency: string, rateDate?: string) {
  const client = requireSupabaseClient();
  const headers = await getAuthHeaders();
  const { data, error } = await client.functions.invoke<ExchangeRateResponse>("get-exchange-rate", {
    headers,
    body: {
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      rate_date: rateDate,
    },
  });

  if (error) throw error;
  if (!data?.rate) throw new AssetRepositoryError("환율 정보를 불러오지 못했습니다.");
  return data.rate;
}

async function getAuthHeaders() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new AssetRepositoryError("로그인 세션 토큰을 찾지 못했습니다. 다시 로그인해주세요.");
  return { Authorization: `Bearer ${accessToken}` };
}

function mapStockRow(row: StockRow): Stock {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    country: row.country,
    market: row.market,
    assetType: row.asset_type,
    currency: row.currency,
    isLargeCap: row.is_large_cap,
  };
}

function mapStockAssetRow(row: StockAssetRow, price?: StockPriceRow, latestFxRate?: ExchangeRateRow): StockAsset {
  if (!row.stocks) {
    throw new AssetRepositoryError("종목 정보를 찾지 못했습니다.");
  }

  const stock = mapStockRow(row.stocks);
  return {
    id: row.id,
    stock,
    quantity: Number(row.quantity),
    averageBuyPrice: Number(row.average_buy_price),
    latestPrice: price ? Number(price.price) : null,
    latestFxRate: stock.currency === "KRW" ? 1 : latestFxRate ? Number(latestFxRate.rate) : null,
    changeRate: price?.change_rate == null ? null : Number(price.change_rate),
    memo: row.memo,
  };
}

function mapDepositAssetRow(row: DepositAssetRow): DepositAsset {
  return {
    id: row.id,
    depositType: row.deposit_type,
    assetName: row.asset_name,
    bankName: row.bank_name,
    currency: row.currency,
    currentAmount: Number(row.current_amount),
    monthlyPayment: row.monthly_payment == null ? null : Number(row.monthly_payment),
    interestRate: row.interest_rate == null ? null : Number(row.interest_rate),
    startDate: row.start_date,
    maturityDate: row.maturity_date,
    memo: row.memo,
  };
}

function mapBondAssetRow(row: BondAssetRow, latestFxRate?: ExchangeRateRow): BondAsset {
  return {
    id: row.id,
    bondName: row.bond_name,
    issuer: row.issuer,
    currency: row.currency,
    principalAmount: Number(row.principal_amount),
    currentValue: Number(row.current_value),
    couponRate: row.coupon_rate == null ? null : Number(row.coupon_rate),
    purchaseFxRate: row.purchase_fx_rate == null ? null : Number(row.purchase_fx_rate),
    latestFxRate: row.currency === "KRW" ? 1 : latestFxRate ? Number(latestFxRate.rate) : null,
    purchaseDate: row.purchase_date,
    maturityDate: row.maturity_date,
    memo: row.memo,
  };
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDateString(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isFreshTimestamp(value: string | null | undefined, ttlMs: number) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < ttlMs;
}
