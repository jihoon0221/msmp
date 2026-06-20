from datetime import UTC, datetime
from math import ceil, isinf
from uuid import uuid4

from schemas import (
    Disclaimer,
    PortfolioAllocation,
    PortfolioRecommendationRequest,
    PortfolioRecommendationResponse,
    ProductCandidate,
    RecommendationRationale,
    RiskProfile,
    SimulationResult,
)


AllocationWeights = dict[str, int]


ALLOCATION_META = {
    "stock-etf": {
        "label": "주식/ETF",
        "color": "#2563eb",
    },
    "deposit-savings": {
        "label": "예금/적금",
        "color": "#16a34a",
    },
    "bond": {
        "label": "채권",
        "color": "#7c3aed",
    },
}

ALLOCATION_ORDER = ["stock-etf", "deposit-savings", "bond"]

PORTFOLIO_TARGETS = {
    RiskProfile.AGGRESSIVE: {
        "label": "공격형",
        "volatility": 14.2,
        "rebalance_cycle": 2,
        "weights": {
            "stock-etf": 70,
            "deposit-savings": 10,
            "bond": 20,
        },
    },
    RiskProfile.NEUTRAL: {
        "label": "중립형",
        "volatility": 9.1,
        "rebalance_cycle": 4,
        "weights": {
            "stock-etf": 50,
            "deposit-savings": 10,
            "bond": 40,
        },
    },
    RiskProfile.STABLE: {
        "label": "안정형",
        "volatility": 4.8,
        "rebalance_cycle": 6,
        "weights": {
            "stock-etf": 10,
            "deposit-savings": 30,
            "bond": 60,
        },
    },
}

DEFAULT_CANDIDATES = {
    "stock-etf": [
        ProductCandidate(
            name="TIGER 미국S&P500",
            category="미국 대표지수",
            reason="낮은 비용으로 미국 대형주에 분산 투자",
            query="TIGER 미국S&P500",
        ),
        ProductCandidate(
            name="KODEX 미국나스닥100TR",
            category="성장주",
            reason="기술주 성장 노출을 높이는 공격형 후보",
            query="KODEX 미국나스닥100TR",
        ),
    ],
    "deposit-savings": [
        ProductCandidate(
            name="고금리 파킹통장",
            category="유동성",
            reason="생활비 변동과 비상금에 대응",
            query="고금리 파킹통장",
        ),
        ProductCandidate(
            name="청년 우대 적금",
            category="정기 적립",
            reason="정해진 목표 기한까지 강제 저축 효과",
            query="청년 우대 적금",
        ),
    ],
    "bond": [
        ProductCandidate(
            name="KODEX 단기채권PLUS",
            category="단기 채권",
            reason="상대적으로 낮은 금리 변동 위험을 추구하는 자산",
            query="KODEX 단기채권PLUS",
        ),
        ProductCandidate(
            name="KOSEF 국고채10년",
            category="장기 국채",
            reason="주식 자산과의 낮은 상관관계를 통한 변동성 완화 추구",
            query="KOSEF 국고채10년",
        ),
    ],
}


def generate_portfolio_recommendation(
    request: PortfolioRecommendationRequest,
) -> PortfolioRecommendationResponse:
    profile = request.financialProfile.riskProfile
    target = _get_goal_aware_target(request)
    expected_return_percent = _get_weighted_expected_return(target["weights"])
    current_assets_manwon = request.financialProfile.currentAssets / 10000
    monthly_investable_manwon = _get_monthly_investable_manwon(request)
    goal_amount_manwon = request.goal.targetAmount / 10000
    cash_months = _simulate_months(current_assets_manwon, monthly_investable_manwon, 2, goal_amount_manwon)
    recommended_months = _simulate_months(
        current_assets_manwon,
        monthly_investable_manwon,
        expected_return_percent,
        goal_amount_manwon,
    )

    return PortfolioRecommendationResponse(
        recommendationId=f"rec_{uuid4().hex}",
        riskProfile=profile,
        label=PORTFOLIO_TARGETS[profile]["label"],
        expectedReturnPercent=expected_return_percent,
        volatilityPercent=PORTFOLIO_TARGETS[profile]["volatility"],
        rebalanceCycleMonths=PORTFOLIO_TARGETS[profile]["rebalance_cycle"],
        simulation=SimulationResult(
            progressPercent=_get_progress_percent(request),
            cashMonths=cash_months,
            recommendedMonths=recommended_months,
            monthSaved=max(0, cash_months - recommended_months),
        ),
        rationale=RecommendationRationale(
            summary=target["summary"],
            factors=target["factors"],
        ),
        allocations=_build_allocations(target["weights"]),
        disclaimer=Disclaimer(
            type="not_investment_advice",
            message="본 추천은 투자 참고용 정보이며 수익을 보장하지 않습니다.",
        ),
        generatedAt=datetime.now(UTC).isoformat(),
    )


def _get_goal_aware_target(request: PortfolioRecommendationRequest):
    profile = request.financialProfile.riskProfile
    base = PORTFOLIO_TARGETS[profile]["weights"]
    months = max(1, request.goal.years * 12)
    goal_amount_manwon = request.goal.targetAmount / 10000
    current_assets_manwon = request.financialProfile.currentAssets / 10000
    remaining_manwon = max(0, goal_amount_manwon - current_assets_manwon)
    required_monthly_investment_manwon = ceil(remaining_manwon / months)
    monthly_investable_manwon = _get_monthly_investable_manwon(request)
    coverage_ratio = (
        monthly_investable_manwon / required_monthly_investment_manwon
        if required_monthly_investment_manwon > 0
        else float("inf")
    )
    horizon = "short" if request.goal.years <= 3 else "mid" if request.goal.years <= 7 else "long"
    feasibility = _get_feasibility(coverage_ratio, required_monthly_investment_manwon)

    stock_weight = base["stock-etf"]

    if horizon == "short":
        short_stock_cap = 60 if profile == RiskProfile.AGGRESSIVE else 45 if profile == RiskProfile.NEUTRAL else 20
        stock_weight = min(stock_weight, short_stock_cap)

    if horizon == "long" and feasibility in ["comfortable", "on-track"]:
        stock_weight += 5 if profile == RiskProfile.STABLE else 10

    if feasibility == "tight":
        stock_weight -= 10 if horizon == "short" else 5

    if feasibility == "stretched":
        stock_weight -= 15 if horizon == "short" else 10

    stock_weight = _clamp(stock_weight, _get_stock_floor(profile), _get_stock_ceiling(profile, horizon))

    defensive_weight = 100 - stock_weight
    base_defensive_weight = base["deposit-savings"] + base["bond"]
    deposit_share = base["deposit-savings"] / base_defensive_weight if base_defensive_weight > 0 else 0.5
    deposit_weight = round(defensive_weight * deposit_share)

    if horizon == "short":
        deposit_weight = max(deposit_weight, 20)
    if feasibility == "stretched":
        deposit_weight = max(deposit_weight, 25)

    deposit_weight = _clamp(deposit_weight, 10, defensive_weight - 10)
    weights = _normalize_weights(
        {
            "stock-etf": stock_weight,
            "deposit-savings": deposit_weight,
            "bond": 100 - stock_weight - deposit_weight,
        }
    )

    return {
        "weights": weights,
        "summary": _build_goal_aware_summary(feasibility, horizon, profile, weights),
        "factors": _build_goal_aware_factors(
            feasibility,
            horizon,
            coverage_ratio,
            required_monthly_investment_manwon,
        ),
    }


def _build_allocations(weights: AllocationWeights) -> list[PortfolioAllocation]:
    return [
        PortfolioAllocation(
            key=key,
            label=ALLOCATION_META[key]["label"],
            weight=weights[key],
            color=ALLOCATION_META[key]["color"],
            candidates=DEFAULT_CANDIDATES[key],
        )
        for key in ALLOCATION_ORDER
    ]


def _get_monthly_investable_manwon(request: PortfolioRecommendationRequest) -> float:
    return max(
        0,
        (request.financialProfile.monthlySalary - request.financialProfile.monthlySpend) / 10000,
    )


def _get_progress_percent(request: PortfolioRecommendationRequest) -> int:
    if request.goal.targetAmount == 0:
        return 100

    return min(100, round(request.financialProfile.currentAssets / request.goal.targetAmount * 100))


def _simulate_months(initial_manwon: float, monthly_manwon: float, annual_rate_percent: float, target_manwon: float) -> int:
    if initial_manwon >= target_manwon:
        return 0
    if monthly_manwon <= 0:
        return 360

    current = initial_manwon
    months = 0
    monthly_rate = annual_rate_percent / 100 / 12

    while current < target_manwon and months < 360:
        current = current * (1 + monthly_rate) + monthly_manwon
        months += 1

    return months


def _get_feasibility(coverage_ratio: float, required_monthly_investment_manwon: int) -> str:
    if required_monthly_investment_manwon == 0:
        return "achieved"
    if coverage_ratio >= 1.2:
        return "comfortable"
    if coverage_ratio >= 1:
        return "on-track"
    if coverage_ratio >= 0.6:
        return "tight"
    return "stretched"


def _get_stock_floor(profile: RiskProfile) -> int:
    if profile == RiskProfile.STABLE:
        return 5
    if profile == RiskProfile.NEUTRAL:
        return 25
    return 40


def _get_stock_ceiling(profile: RiskProfile, horizon: str) -> int:
    if profile == RiskProfile.STABLE:
        return 20 if horizon == "short" else 30
    if profile == RiskProfile.NEUTRAL:
        return 45 if horizon == "short" else 65
    return 60 if horizon == "short" else 80


def _normalize_weights(weights: AllocationWeights) -> AllocationWeights:
    total = weights["stock-etf"] + weights["deposit-savings"] + weights["bond"]
    if total == 100:
        return weights

    return {
        **weights,
        "bond": weights["bond"] + (100 - total),
    }


def _get_weighted_expected_return(weights: AllocationWeights) -> float:
    return round((weights["stock-etf"] * 0.075 + weights["deposit-savings"] * 0.032 + weights["bond"] * 0.045) * 10) / 10


def _build_goal_aware_summary(
    feasibility: str,
    horizon: str,
    profile: RiskProfile,
    weights: AllocationWeights,
) -> str:
    horizon_text = "목표 기간이 짧아" if horizon == "short" else "목표 기간이 중간 정도라" if horizon == "mid" else "목표 기간이 길어"
    feasibility_text = {
        "comfortable": "월 투자 여력이 충분한 편입니다",
        "on-track": "월 투자 여력이 목표 달성 최소 월 투자금과 비슷합니다",
        "tight": "목표 달성 여력이 다소 빠듯합니다",
        "stretched": "현재 조건만으로는 목표 달성 여력이 부족합니다",
        "achieved": "현재 자산이 목표 금액에 도달했거나 거의 도달했습니다",
    }[feasibility]
    risk_text = {
        RiskProfile.AGGRESSIVE: "공격형 성향",
        RiskProfile.NEUTRAL: "중립형 성향",
        RiskProfile.STABLE: "안정형 성향",
    }[profile]

    return (
        f"{feasibility_text}. {horizon_text} {risk_text}을 그대로 적용하지 않고 "
        f"주식/ETF {weights['stock-etf']}%, 예금/적금 {weights['deposit-savings']}%, 채권 {weights['bond']}%로 보정했습니다."
    )


def _build_goal_aware_factors(
    feasibility: str,
    horizon: str,
    coverage_ratio: float,
    required_monthly_investment_manwon: int,
) -> list[str]:
    coverage_text = f"{round(coverage_ratio * 100)}%" if not isinf(coverage_ratio) else "충족"
    horizon_factor = (
        "단기 목표라 손실 회복 시간을 고려해 주식/ETF 비중 상한 적용"
        if horizon == "short"
        else "중기 목표라 투자성향 기본 비중을 중심으로 제한적 보정"
        if horizon == "mid"
        else "장기 목표라 투자성향에 따라 성장 자산 비중을 일부 확대 가능"
    )
    factors = [
        f"목표 달성 최소 월 투자금 {required_monthly_investment_manwon:,}만원 기준 달성 여력 비율 {coverage_text}",
        horizon_factor,
    ]

    if feasibility in ["tight", "stretched"]:
        factors.append("목표가 빠듯할수록 위험자산 확대보다 월 투자 여력, 목표 금액, 목표 기간 조정 검토")

    return factors


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return min(maximum, max(minimum, value))
