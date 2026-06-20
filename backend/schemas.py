from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class GoalType(str, Enum):
    JEONSE = "jeonse"
    SEED = "seed"
    CAR = "car"
    WEDDING = "wedding"
    OTHER = "other"


class RiskProfile(str, Enum):
    STABLE = "stable"
    NEUTRAL = "neutral"
    AGGRESSIVE = "aggressive"


class GoalInput(BaseModel):
    type: GoalType
    targetAmount: int = Field(ge=0)
    years: int = Field(ge=1, le=50)
    customLabel: str | None = None


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


class ValuationStock(BaseModel):
    id: str
    symbol: str
    name: str
    country: str
    market: str
    assetType: Literal["stock", "etf"] | str
    currency: str
    isLargeCap: bool


class StockAssetValuationInput(BaseModel):
    id: str
    stock: ValuationStock
    quantity: float = Field(ge=0)
    averageBuyPrice: float = Field(ge=0)
    latestPrice: float | None = Field(default=None, ge=0)
    latestFxRate: float | None = Field(default=None, gt=0)
    changeRate: float | None = None
    memo: str | None = None


class DepositAssetValuationInput(BaseModel):
    id: str
    depositType: Literal["deposit", "installment_savings"]
    assetName: str
    bankName: str | None = None
    currency: str
    currentAmount: float = Field(ge=0)
    monthlyPayment: float | None = Field(default=None, ge=0)
    interestRate: float | None = None
    startDate: str | None = None
    maturityDate: str | None = None
    memo: str | None = None


class BondAssetValuationInput(BaseModel):
    id: str
    bondName: str
    issuer: str | None = None
    currency: str
    principalAmount: float = Field(ge=0)
    currentValue: float = Field(ge=0)
    couponRate: float | None = None
    purchaseFxRate: float | None = Field(default=None, gt=0)
    latestFxRate: float | None = Field(default=None, gt=0)
    purchaseDate: str | None = None
    maturityDate: str | None = None
    memo: str | None = None


class AssetValuationRequest(BaseModel):
    stockAssets: list[StockAssetValuationInput] = Field(default_factory=list)
    depositAssets: list[DepositAssetValuationInput] = Field(default_factory=list)
    bondAssets: list[BondAssetValuationInput] = Field(default_factory=list)


class AssetCurrencySummary(BaseModel):
    currency: str
    totalValue: float


class AssetAllocationValuation(BaseModel):
    key: str
    label: str
    weight: int
    valueKrw: float
    color: str


class StockAssetValuation(BaseModel):
    id: str
    currency: str
    purchaseValueNative: float
    currentValueNative: float | None
    effectiveValueNative: float
    purchaseValueKrw: float | None
    valueKrw: float | None
    profitLossNative: float | None
    returnPercent: float | None
    fxRate: float | None


class DepositAssetValuation(BaseModel):
    id: str
    currency: str
    valueNative: float
    valueKrw: float | None
    fxRate: float | None


class BondAssetValuation(BaseModel):
    id: str
    currency: str
    principalValueKrw: float
    currentValueKrw: float
    profitLossKrw: float
    returnPercent: float
    purchaseFxRate: float
    currentFxRate: float
    accruedValueNative: float


class AssetValuationResponse(BaseModel):
    totalValueKrw: float
    currencySummaries: list[AssetCurrencySummary]
    allocations: list[AssetAllocationValuation]
    stockAssets: list[StockAssetValuation]
    depositAssets: list[DepositAssetValuation]
    bondAssets: list[BondAssetValuation]
    generatedAt: str
