from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class GoalType(str, Enum):
    JEONSE = "jeonse"
    SEED = "seed"
    CAR = "car"
    WEDDING = "wedding"


class RiskProfile(str, Enum):
    STABLE = "stable"
    NEUTRAL = "neutral"
    AGGRESSIVE = "aggressive"


class GoalInput(BaseModel):
    type: GoalType
    targetAmount: int = Field(ge=0)
    years: int = Field(ge=1, le=50)


class FinancialProfileInput(BaseModel):
    currentAssets: int = Field(ge=0)
    monthlySalary: int = Field(ge=0)
    monthlySpend: int = Field(ge=0)
    riskProfile: RiskProfile


class PortfolioRecommendationRequest(BaseModel):
    goal: GoalInput
    financialProfile: FinancialProfileInput


class SimulationResult(BaseModel):
    progressPercent: int
    cashMonths: int
    recommendedMonths: int
    monthSaved: int


class RecommendationRationale(BaseModel):
    summary: str
    factors: list[str]


class ProductCandidate(BaseModel):
    name: str
    category: str
    reason: str
    query: str


class PortfolioAllocation(BaseModel):
    key: str
    label: str
    weight: int
    color: str
    candidates: list[ProductCandidate]


class Disclaimer(BaseModel):
    type: Literal["not_investment_advice"]
    message: str


class PortfolioRecommendationResponse(BaseModel):
    recommendationId: str
    riskProfile: RiskProfile
    label: str
    expectedReturnPercent: float
    volatilityPercent: float
    rebalanceCycleMonths: int
    simulation: SimulationResult
    rationale: RecommendationRationale
    allocations: list[PortfolioAllocation]
    disclaimer: Disclaimer
    generatedAt: str


class RelatedNewsRequest(BaseModel):
    tickers: list[str] = Field(default_factory=list)
    assetNames: list[str] = Field(default_factory=list)
    candidateQueries: list[str] = Field(default_factory=list)
    goalType: GoalType | None = None
    riskProfile: RiskProfile | None = None
    limitPerKeyword: int = Field(default=1, ge=1, le=5)


class RelatedNewsArticle(BaseModel):
    id: str
    matchedKeyword: str
    ticker: str | None
    source: str
    title: str
    summary: str
    url: str
    publishedAt: str | None
    fetchedAt: str


class RelatedNewsResponse(BaseModel):
    articles: list[RelatedNewsArticle]
    digestSummary: list[dict] = Field(default_factory=list)
