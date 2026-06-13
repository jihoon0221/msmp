from datetime import UTC, datetime
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


PORTFOLIO_TEMPLATES = {
    RiskProfile.STABLE: {
        "label": "안정형",
        "expected_return": 4.2,
        "volatility": 5.4,
        "rebalance_cycle": 6,
        "allocations": [
            ("bond", "국공채/단기채 ETF", 45, "#7c3aed"),
            ("cash", "파킹/CMA", 25, "#16a34a"),
            ("global-equity", "글로벌 주식 ETF", 20, "#2563eb"),
            ("alternative", "금/대체 ETF", 10, "#f59e0b"),
        ],
    },
    RiskProfile.NEUTRAL: {
        "label": "중립형",
        "expected_return": 6.4,
        "volatility": 9.1,
        "rebalance_cycle": 4,
        "allocations": [
            ("global-equity", "글로벌 주식 ETF", 40, "#2563eb"),
            ("bond", "국공채/단기채 ETF", 30, "#7c3aed"),
            ("cash", "파킹/CMA", 20, "#16a34a"),
            ("alternative", "금/대체 ETF", 10, "#f59e0b"),
        ],
    },
    RiskProfile.AGGRESSIVE: {
        "label": "공격형",
        "expected_return": 8.5,
        "volatility": 14.2,
        "rebalance_cycle": 2,
        "allocations": [
            ("global-equity", "글로벌 주식 ETF", 55, "#2563eb"),
            ("bond", "국공채/단기채 ETF", 20, "#7c3aed"),
            ("cash", "파킹/CMA", 15, "#16a34a"),
            ("alternative", "금/대체 ETF", 10, "#f59e0b"),
        ],
    },
}


DEFAULT_CANDIDATES = {
    "global-equity": [
        ProductCandidate(
            name="TIGER 미국S&P500",
            category="미국 대표지수",
            reason="낮은 비용으로 미국 대형주에 분산 투자",
            query="TIGER 미국S&P500",
        )
    ],
    "bond": [
        ProductCandidate(
            name="KOSEF 국고채10년",
            category="장기 국채",
            reason="주식 자산과의 낮은 상관관계를 통한 변동성 완화 추구",
            query="KOSEF 국고채10년",
        )
    ],
    "cash": [
        ProductCandidate(
            name="CMA RP형",
            category="대기 자금",
            reason="리밸런싱과 비상금 용도의 즉시 유동성",
            query="CMA RP형",
        )
    ],
    "alternative": [
        ProductCandidate(
            name="ACE KRX금현물",
            category="대체 자산",
            reason="통화/물가 변동성 방어 목적",
            query="ACE KRX금현물",
        )
    ],
}


def generate_portfolio_recommendation(
    request: PortfolioRecommendationRequest,
) -> PortfolioRecommendationResponse:
    # TODO: Replace this deterministic template with the selected AI provider call.
    profile = request.financialProfile.riskProfile
    template = PORTFOLIO_TEMPLATES[profile]
    monthly_investable = max(
        0,
        request.financialProfile.monthlySalary - request.financialProfile.monthlySpend,
    )
    progress_percent = (
        100
        if request.goal.targetAmount == 0
        else min(100, round(request.financialProfile.currentAssets / request.goal.targetAmount * 100))
    )

    allocations = [
        PortfolioAllocation(
            key=key,
            label=label,
            weight=weight,
            color=color,
            candidates=DEFAULT_CANDIDATES.get(key, []),
        )
        for key, label, weight, color in template["allocations"]
    ]

    return PortfolioRecommendationResponse(
        recommendationId=f"rec_{uuid4().hex}",
        riskProfile=profile,
        label=template["label"],
        expectedReturnPercent=template["expected_return"],
        volatilityPercent=template["volatility"],
        rebalanceCycleMonths=template["rebalance_cycle"],
        simulation=SimulationResult(
            progressPercent=progress_percent,
            cashMonths=36,
            recommendedMonths=30 if monthly_investable > 0 else 360,
            monthSaved=6 if monthly_investable > 0 else 0,
        ),
        rationale=RecommendationRationale(
            summary="AI 추천 API 연동 전 임시 템플릿 응답입니다.",
            factors=[
                f"투자성향: {profile.value}",
                f"목표 기간: {request.goal.years}년",
                f"월 투자 가능 금액: {monthly_investable}원",
            ],
        ),
        allocations=allocations,
        disclaimer=Disclaimer(
            type="not_investment_advice",
            message="본 추천은 투자 참고용 정보이며 수익을 보장하지 않습니다.",
        ),
        generatedAt=datetime.now(UTC).isoformat(),
    )

