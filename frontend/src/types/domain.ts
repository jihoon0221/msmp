export type RiskProfile = "stable" | "neutral" | "aggressive";

export type GoalType = "jeonse" | "seed" | "car" | "wedding" | "other";

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
  customGoalLabel?: string;
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

export type RelatedNewsArticle = {
  id: string;
  matchedKeyword: string;
  ticker: string | null;
  source: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
};

export type StockAssetFilter = "all" | "kr_stock" | "us_stock" | "kr_etf" | "us_etf";

export type Stock = {
  id: string;
  symbol: string;
  name: string;
  country: "KR" | "US" | string;
  market: string;
  assetType: "stock" | "etf";
  currency: "KRW" | "USD" | string;
  isLargeCap: boolean;
};

export type StockAsset = {
  id: string;
  stock: Stock;
  quantity: number;
  averageBuyPrice: number;
  latestPrice: number | null;
  changeRate: number | null;
  memo: string | null;
};

export type DepositAsset = {
  id: string;
  depositType: "deposit" | "installment_savings";
  assetName: string;
  bankName: string | null;
  currency: string;
  currentAmount: number;
  monthlyPayment: number | null;
  interestRate: number | null;
  startDate: string | null;
  maturityDate: string | null;
  memo: string | null;
};

export type BondAsset = {
  id: string;
  bondName: string;
  issuer: string | null;
  currency: string;
  principalAmount: number;
  currentValue: number;
  couponRate: number | null;
  purchaseDate: string | null;
  maturityDate: string | null;
  memo: string | null;
};

export type AssetPortfolio = {
  stockAssets: StockAsset[];
  depositAssets: DepositAsset[];
  bondAssets: BondAsset[];
};

export type ModalContent = {
  title: string;
  body: string;
};
