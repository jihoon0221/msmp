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
  purchase_date: string | null;
  maturity_date: string | null;
  memo: string | null;
};

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
  principalAmount: number;
  currentValue: number;
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
        .select("id, bond_name, issuer, currency, principal_amount, current_value, coupon_rate, purchase_date, maturity_date, memo")
        .order("created_at", { ascending: false }),
    ]);

  if (stockError) throw stockError;
  if (depositError) throw depositError;
  if (bondError) throw bondError;

  const typedStockRows = (stockRows ?? []) as unknown as StockAssetRow[];
  const stockIds = typedStockRows.map((row) => row.stock_id);
  const latestPrices = await getLatestStockPrices(stockIds);

  return {
    stockAssets: typedStockRows.map((row) => mapStockAssetRow(row, latestPrices.get(row.stock_id))),
    depositAssets: ((depositRows ?? []) as DepositAssetRow[]).map(mapDepositAssetRow),
    bondAssets: ((bondRows ?? []) as BondAssetRow[]).map(mapBondAssetRow),
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

  await refreshStockPrices([input.stockId]);
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

export async function createBondAsset(input: BondAssetInput) {
  const client = requireSupabaseClient();
  const userId = await requireUserId();

  const { error } = await client.from("user_bond_assets").insert({
    user_id: userId,
    bond_name: input.bondName,
    issuer: emptyToNull(input.issuer),
    principal_amount: input.principalAmount,
    current_value: input.currentValue,
    coupon_rate: input.couponRate ?? null,
    purchase_date: emptyToNull(input.purchaseDate),
    maturity_date: emptyToNull(input.maturityDate),
    memo: emptyToNull(input.memo),
  });

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

export async function refreshStockPrices(stockIds: string[]) {
  const client = requireSupabaseClient();
  if (stockIds.length === 0) return;

  const { error } = await client.functions.invoke("get-stock-price", {
    body: {
      stock_ids: stockIds,
    },
  });

  if (error) {
    console.warn("Failed to refresh stock prices", error);
  }
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new AssetRepositoryError("Supabase 환경변수가 설정되지 않았습니다.");
  }
  return supabase;
}

async function requireUserId() {
  const client = requireSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) throw error;
  if (!user) throw new AssetRepositoryError("로그인 후 보유자산을 관리할 수 있습니다.");
  return user.id;
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

function mapStockAssetRow(row: StockAssetRow, price?: StockPriceRow): StockAsset {
  if (!row.stocks) {
    throw new AssetRepositoryError("종목 정보를 찾지 못했습니다.");
  }

  return {
    id: row.id,
    stock: mapStockRow(row.stocks),
    quantity: Number(row.quantity),
    averageBuyPrice: Number(row.average_buy_price),
    latestPrice: price ? Number(price.price) : null,
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

function mapBondAssetRow(row: BondAssetRow): BondAsset {
  return {
    id: row.id,
    bondName: row.bond_name,
    issuer: row.issuer,
    currency: row.currency,
    principalAmount: Number(row.principal_amount),
    currentValue: Number(row.current_value),
    couponRate: row.coupon_rate == null ? null : Number(row.coupon_rate),
    purchaseDate: row.purchase_date,
    maturityDate: row.maturity_date,
    memo: row.memo,
  };
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
