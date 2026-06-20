import type { AssetPortfolio } from "../types/domain";

export type AssetPortfolioNewsInputs = {
  assetNames: string[];
  tickers: string[];
};

export const emptyAssetPortfolio: AssetPortfolio = {
  stockAssets: [],
  depositAssets: [],
  bondAssets: [],
};

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

function addIfPresent(values: Set<string>, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) values.add(trimmed);
}
