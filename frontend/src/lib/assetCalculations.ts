import type { AssetPortfolio, BondAsset, DepositAsset, PortfolioAllocation, StockAsset } from "../types/domain";

export type StockAssetMetrics = {
  purchaseValue: number;
  currentValue: number | null;
  profitLoss: number | null;
  returnPercent: number | null;
};

export type BondAssetMetrics = {
  profitLoss: number;
  returnPercent: number;
};

export type AssetCurrencySummary = {
  currency: string;
  totalValue: number;
};

export type AssetPortfolioNewsInputs = {
  assetNames: string[];
  tickers: string[];
};

const assetAllocationColors = ["#2563eb", "#7c3aed", "#16a34a", "#f59e0b", "#0891b2", "#db2777"];

export const emptyAssetPortfolio: AssetPortfolio = {
  stockAssets: [],
  depositAssets: [],
  bondAssets: [],
};

export function calculateStockAssetMetrics(asset: StockAsset): StockAssetMetrics {
  const purchaseValue = asset.quantity * asset.averageBuyPrice;

  if (asset.latestPrice == null) {
    return {
      purchaseValue,
      currentValue: null,
      profitLoss: null,
      returnPercent: null,
    };
  }

  const currentValue = asset.quantity * asset.latestPrice;
  const profitLoss = currentValue - purchaseValue;

  return {
    purchaseValue,
    currentValue,
    profitLoss,
    returnPercent: purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0,
  };
}

export function getDepositAssetValue(asset: DepositAsset) {
  return asset.currentAmount;
}

export function calculateBondAssetMetrics(asset: BondAsset): BondAssetMetrics {
  const profitLoss = asset.currentValue - asset.principalAmount;
  return {
    profitLoss,
    returnPercent: asset.principalAmount > 0 ? (profitLoss / asset.principalAmount) * 100 : 0,
  };
}

export function summarizeAssetPortfolioByCurrency(portfolio: AssetPortfolio): AssetCurrencySummary[] {
  const totals = new Map<string, number>();

  for (const asset of portfolio.stockAssets) {
    const metrics = calculateStockAssetMetrics(asset);
    addToCurrencyTotal(totals, asset.stock.currency, metrics.currentValue ?? metrics.purchaseValue);
  }

  for (const asset of portfolio.depositAssets) {
    addToCurrencyTotal(totals, asset.currency, getDepositAssetValue(asset));
  }

  for (const asset of portfolio.bondAssets) {
    addToCurrencyTotal(totals, asset.currency, asset.currentValue);
  }

  return Array.from(totals, ([currency, totalValue]) => ({ currency, totalValue }));
}

export function countAssetPortfolioItems(portfolio: AssetPortfolio) {
  return portfolio.stockAssets.length + portfolio.depositAssets.length + portfolio.bondAssets.length;
}

export function buildAssetPortfolioAllocations(portfolio: AssetPortfolio): PortfolioAllocation[] {
  const buckets = new Map<string, number>();

  for (const asset of portfolio.stockAssets) {
    const metrics = calculateStockAssetMetrics(asset);
    addToBucket(buckets, getStockAssetBucketLabel(asset), metrics.currentValue ?? metrics.purchaseValue);
  }

  for (const asset of portfolio.depositAssets) {
    addToBucket(buckets, "예금/적금", getDepositAssetValue(asset));
  }

  for (const asset of portfolio.bondAssets) {
    addToBucket(buckets, "채권", asset.currentValue);
  }

  const totalValue = Array.from(buckets.values()).reduce((total, value) => total + value, 0);
  if (totalValue <= 0) return [];

  return Array.from(buckets.entries()).map(([label, value], index) => ({
    key: `asset-${label}`,
    label,
    weight: Math.round((value / totalValue) * 100),
    color: assetAllocationColors[index % assetAllocationColors.length],
    candidates: [],
  }));
}

export function getAssetPortfolioNewsInputs(portfolio: AssetPortfolio): AssetPortfolioNewsInputs {
  const assetNames = new Set<string>();
  const tickers = new Set<string>();

  for (const asset of portfolio.stockAssets) {
    addIfPresent(assetNames, asset.stock.name);
    addIfPresent(tickers, asset.stock.symbol);
  }

  for (const asset of portfolio.depositAssets) {
    addIfPresent(assetNames, asset.assetName);
  }

  for (const asset of portfolio.bondAssets) {
    addIfPresent(assetNames, asset.bondName);
  }

  return {
    assetNames: Array.from(assetNames),
    tickers: Array.from(tickers),
  };
}

function addToCurrencyTotal(totals: Map<string, number>, currency: string, value: number) {
  totals.set(currency, (totals.get(currency) ?? 0) + value);
}

function addToBucket(buckets: Map<string, number>, label: string, value: number) {
  if (value <= 0) return;
  buckets.set(label, (buckets.get(label) ?? 0) + value);
}

function getStockAssetBucketLabel(asset: StockAsset) {
  if (asset.stock.assetType === "etf") {
    return asset.stock.country === "KR" ? "국내 ETF" : "해외 ETF";
  }

  return asset.stock.country === "KR" ? "국내 주식" : "해외 주식";
}

function addIfPresent(values: Set<string>, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) values.add(trimmed);
}
