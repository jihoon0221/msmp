export type RiskProfile = "stable" | "neutral" | "aggressive";

export type GoalType = "jeonse" | "seed" | "car" | "wedding";

export type AppTab = "home" | "assets" | "explore" | "my";

export type GoalOption = {
  value: GoalType;
  label: string;
  shortLabel: string;
};

export type FinancialInputs = {
  goalType: GoalType;
  goalAmountManwon: number;
  goalYears: number;
  currentAssetsManwon: number;
  monthlySalaryManwon: number;
  monthlySpendManwon: number;
  riskProfile: RiskProfile;
};

export type ProductCandidate = {
  name: string;
  category: string;
  reason: string;
  query: string;
};

export type PortfolioAllocation = {
  key: string;
  label: string;
  weight: number;
  color: string;
  candidates: ProductCandidate[];
};

export type ActualAsset = {
  id: string;
  category: string;
  name: string;
  purchasePrice: number;
  quantity: number;
};

export type PortfolioModel = {
  riskProfile: RiskProfile;
  label: string;
  expectedReturnPercent: number;
  volatilityPercent: number;
  rebalanceCycleMonths: number;
  xaiSummary: string;
  rationaleFactors: string[];
  allocations: PortfolioAllocation[];
};

export type SimulationStats = {
  progressPercent: number;
  cashMonths: number;
  aiMonths: number;
  monthSaved: number;
};

export type ExploreArticle = {
  title: string;
  tag: string;
  source: string;
  desc: string;
  icon: string;
  link: string;
};

export type ModalContent = {
  title: string;
  body: string;
};
