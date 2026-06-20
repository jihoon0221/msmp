import type { AssetValuation } from "../types/domain";

export const emptyAssetValuation: AssetValuation = {
  totalValueKrw: 0,
  currencySummaries: [],
  allocations: [
    { key: "stock-etf", label: "주식/ETF", weight: 0, color: "#2563eb", valueKrw: 0 },
    { key: "deposit-savings", label: "예금/적금", weight: 0, color: "#16a34a", valueKrw: 0 },
    { key: "bond", label: "채권", weight: 0, color: "#f59e0b", valueKrw: 0 },
  ],
  stockAssets: [],
  depositAssets: [],
  bondAssets: [],
  generatedAt: "",
};
