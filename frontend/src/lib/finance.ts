import { getGoalLabel } from "../constants/goals";
import { portfolioModels } from "../constants/portfolioModels";
import type { ActualAsset, FinancialInputs, PortfolioAllocation, PortfolioModel, SimulationStats } from "../types/domain";

export const defaultFinancialInputs: FinancialInputs = {
  goalType: "jeonse",
  goalAmountManwon: 5000,
  goalYears: 3,
  currentAssetsManwon: 1500,
  monthlySalaryManwon: 320,
  monthlySpendManwon: 180,
  riskProfile: "aggressive",
};

export const riskOrder = ["stable", "neutral", "aggressive"] as const;

export const getMonthlyInvestable = (inputs: FinancialInputs) =>
  Math.max(0, inputs.monthlySalaryManwon - inputs.monthlySpendManwon);

export const getPortfolioModel = (inputs: FinancialInputs): PortfolioModel =>
  portfolioModels[inputs.riskProfile];

export const simulateMonths = (
  initialManwon: number,
  monthlyManwon: number,
  annualRatePercent: number,
  targetManwon: number,
) => {
  if (initialManwon >= targetManwon) return 0;
  if (monthlyManwon <= 0) return 360;

  let current = initialManwon;
  let months = 0;
  const monthlyRate = annualRatePercent / 100 / 12;

  while (current < targetManwon && months < 360) {
    current = current * (1 + monthlyRate) + monthlyManwon;
    months += 1;
  }

  return months;
};

export const computeSimulationStats = (
  inputs: FinancialInputs,
  model: PortfolioModel,
): SimulationStats => {
  const monthlyInvestable = getMonthlyInvestable(inputs);
  const cashMonths = simulateMonths(
    inputs.currentAssetsManwon,
    monthlyInvestable,
    2,
    inputs.goalAmountManwon,
  );
  const aiMonths = simulateMonths(
    inputs.currentAssetsManwon,
    monthlyInvestable,
    model.expectedReturnPercent,
    inputs.goalAmountManwon,
  );

  return {
    progressPercent: Math.min(
      100,
      Math.round((inputs.currentAssetsManwon / inputs.goalAmountManwon) * 100),
    ),
    cashMonths,
    aiMonths,
    monthSaved: Math.max(0, cashMonths - aiMonths),
  };
};

export const getPlanHeadline = (inputs: FinancialInputs) =>
  `${inputs.goalYears}년 뒤 ${getGoalLabel(inputs.goalType)}`;

const actualAssetColors = ["#2563eb", "#7c3aed", "#16a34a", "#f59e0b", "#0891b2", "#db2777"];

export const getActualAssetValue = (asset: ActualAsset) => asset.currentPrice * asset.quantity;

export const getActualTotalValue = (assets: ActualAsset[]) =>
  assets.reduce((total, asset) => total + getActualAssetValue(asset), 0);

export const buildActualAllocations = (assets: ActualAsset[]): PortfolioAllocation[] => {
  const total = getActualTotalValue(assets);
  if (total <= 0) return [];

  const categoryValues = assets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.category] = (acc[asset.category] ?? 0) + getActualAssetValue(asset);
    return acc;
  }, {});

  return Object.entries(categoryValues).map(([category, value], index) => ({
    key: `actual-${category}`,
    label: category,
    weight: Math.round((value / total) * 100),
    color: actualAssetColors[index % actualAssetColors.length],
    candidates: [],
  }));
};
