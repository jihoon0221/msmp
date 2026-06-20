import type {
  AssetPortfolio,
  AssetValuation,
  FinancialInputs,
  PortfolioAllocation,
  PortfolioModel,
  RelatedNewsArticle,
} from "../types/domain";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type GoalType = FinancialInputs["goalType"];
type RiskProfile = FinancialInputs["riskProfile"];

type PortfolioRecommendationResponse = {
  recommendationId: string;
  riskProfile: RiskProfile;
  label: string;
  expectedReturnPercent: number;
  volatilityPercent: number;
  rebalanceCycleMonths: number;
  rationale: {
    summary: string;
    factors: string[];
  };
  allocations: PortfolioAllocation[];
};

type RelatedNewsResponse = {
  articles: RelatedNewsArticle[];
};

export class MoneyPilotApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyPilotApiError";
  }
}

export async function requestPortfolioRecommendation(inputs: FinancialInputs): Promise<PortfolioModel> {
  const response = await postJson<PortfolioRecommendationResponse>("/api/v1/portfolio/recommendations", {
    goal: {
      type: inputs.goalType,
      targetAmount: inputs.goalAmountManwon * 10000,
      years: inputs.goalYears,
      customLabel: inputs.customGoalLabel,
    },
    financialProfile: {
      currentAssets: inputs.currentAssetsManwon * 10000,
      monthlySalary: inputs.monthlySalaryManwon * 10000,
      monthlySpend: inputs.monthlySpendManwon * 10000,
      riskProfile: inputs.riskProfile,
    },
  });

  return {
    riskProfile: response.riskProfile,
    label: response.label,
    expectedReturnPercent: response.expectedReturnPercent,
    volatilityPercent: response.volatilityPercent,
    rebalanceCycleMonths: response.rebalanceCycleMonths,
    xaiSummary: response.rationale.summary,
    rationaleFactors: response.rationale.factors,
    allocations: response.allocations,
  };
}

export async function requestAssetValuation(portfolio: AssetPortfolio): Promise<AssetValuation> {
  return postJson<AssetValuation>("/api/v1/assets/valuation", portfolio);
}

export async function requestRelatedNews(params: {
  assetNames: string[];
  tickers: string[];
  goalType: GoalType;
  riskProfile: RiskProfile;
  candidateQueries: string[];
}): Promise<RelatedNewsArticle[]> {
  const response = await postJson<RelatedNewsResponse>("/api/v1/news/related", {
    assetNames: [...params.assetNames, ...params.candidateQueries],
    tickers: params.tickers,
    goalType: params.goalType,
    riskProfile: params.riskProfile,
    limitPerKeyword: 1,
  });

  return response.articles;
}

async function postJson<ResponseBody>(path: string, body: unknown): Promise<ResponseBody> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new MoneyPilotApiError(`API 요청 실패 (${response.status})`);
  }

  return (await response.json()) as ResponseBody;
}
