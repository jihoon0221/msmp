import { getGoalLabel } from "../constants/goals";
import { buildGoalAwarePortfolioModel, portfolioModels } from "../constants/portfolioModels";
import type { FinancialInputs, PortfolioModel, SimulationStats } from "../types/domain";

export const defaultFinancialInputs: FinancialInputs = {
  goalType: "jeonse",
  goalAmountManwon: 5000,
  goalYears: 3,
  customGoalLabel: "",
  currentAssetsManwon: 1500,
  monthlySalaryManwon: 320,
  monthlySpendManwon: 180,
  riskProfile: "aggressive",
};

export const getMonthlyInvestable = (inputs: FinancialInputs) =>
  Math.max(0, inputs.monthlySalaryManwon - inputs.monthlySpendManwon);

export const getFallbackPortfolioModel = (inputs: FinancialInputs): PortfolioModel =>
  buildGoalAwarePortfolioModel(portfolioModels[inputs.riskProfile], inputs);

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
  `${inputs.goalYears}년 뒤 ${
    inputs.goalType === "other" ? inputs.customGoalLabel || "기타" : getGoalLabel(inputs.goalType)
  }`;
