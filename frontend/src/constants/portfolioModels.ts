import type { PortfolioAllocation, PortfolioModel } from "../types/domain";

const rawPortfolioModels: Record<PortfolioModel["riskProfile"], PortfolioModel> = {
  aggressive: {
    riskProfile: "aggressive",
    label: "공격형",
    expectedReturnPercent: 8.5,
    volatilityPercent: 14.2,
    rebalanceCycleMonths: 2,
    xaiSummary:
      "목표 기한이 비교적 짧더라도 월 투자 여력이 충분한 편입니다. 장기 성장 자산 비중을 높이되 국공채와 현금성 자산을 함께 두어 급락 시 추가 매수 여력을 남깁니다.",
    rationaleFactors: [
      "월 잉여 현금흐름을 핵심 성장 ETF에 우선 배분",
      "상관관계가 낮은 채권형 ETF로 하방 변동성 완화 추구",
      "2개월 단위 리밸런싱으로 목표 비중 이탈을 빠르게 복구",
    ],
    allocations: [
      {
        key: "global-equity",
        label: "글로벌 주식 ETF",
        weight: 55,
        color: "#2563eb",
        candidates: [
          {
            name: "TIGER 미국S&P500",
            category: "미국 대표지수",
            reason: "낮은 비용으로 미국 대형주에 분산 투자",
            query: "TIGER 미국S&P500",
          },
          {
            name: "KODEX 미국나스닥100TR",
            category: "성장주",
            reason: "기술주 성장 노출을 높이는 공격형 후보",
            query: "KODEX 미국나스닥100TR",
          },
        ],
      },
      {
        key: "bond",
        label: "국공채/단기채 ETF",
        weight: 20,
        color: "#7c3aed",
        candidates: [
          {
            name: "KOSEF 국고채10년",
            category: "장기 국채",
            reason: "주식 자산과의 낮은 상관관계를 통한 변동성 완화 추구",
            query: "KOSEF 국고채10년",
          },
        ],
      },
      {
        key: "cash",
        label: "예적금",
        weight: 15,
        color: "#16a34a",
        candidates: [
          {
            name: "CMA RP형",
            category: "대기 자금",
            reason: "리밸런싱과 비상금 용도의 즉시 유동성",
            query: "CMA RP형",
          },
        ],
      },
      {
        key: "alternative",
        label: "금/대체 ETF",
        weight: 10,
        color: "#f59e0b",
        candidates: [
          {
            name: "ACE KRX금현물",
            category: "대체 자산",
            reason: "통화/물가 변동성 방어 목적",
            query: "ACE KRX금현물",
          },
        ],
      },
    ],
  },
  neutral: {
    riskProfile: "neutral",
    label: "중립형",
    expectedReturnPercent: 6.4,
    volatilityPercent: 9.1,
    rebalanceCycleMonths: 4,
    xaiSummary:
      "목표 달성과 손실 가능성을 함께 고려하는 배분 예시입니다. 성장 자산과 금리형 자산을 비슷하게 두어 현금흐름 변동성 완화를 추구합니다.",
    rationaleFactors: [
      "주식형 ETF와 채권형 ETF의 균형 배분",
      "월 배당/이자형 자산으로 심리적 유지 가능성 확보",
      "4개월 단위 점검으로 거래 부담을 줄임",
    ],
    allocations: [
      {
        key: "global-equity",
        label: "글로벌 주식 ETF",
        weight: 40,
        color: "#2563eb",
        candidates: [
          {
            name: "TIGER 미국S&P500",
            category: "미국 대표지수",
            reason: "장기 성장성과 분산 효과의 균형",
            query: "TIGER 미국S&P500",
          },
        ],
      },
      {
        key: "bond",
        label: "국공채/단기채 ETF",
        weight: 30,
        color: "#7c3aed",
        candidates: [
          {
            name: "KODEX 단기채권PLUS",
            category: "단기 채권",
            reason: "상대적으로 낮은 금리 변동 위험을 추구하는 자산",
            query: "KODEX 단기채권PLUS",
          },
        ],
      },
      {
        key: "income",
        label: "배당/인컴 ETF",
        weight: 20,
        color: "#0f766e",
        candidates: [
          {
            name: "SOL 미국배당다우존스",
            category: "배당 성장",
            reason: "현금흐름과 장기 배당 성장 동시 추구",
            query: "SOL 미국배당다우존스",
          },
        ],
      },
      {
        key: "cash",
        label: "예적금",
        weight: 10,
        color: "#16a34a",
        candidates: [
          {
            name: "고금리 파킹통장",
            category: "유동성",
            reason: "생활비 변동과 비상금에 대응",
            query: "고금리 파킹통장",
          },
        ],
      },
    ],
  },
  stable: {
    riskProfile: "stable",
    label: "안정형",
    expectedReturnPercent: 4.1,
    volatilityPercent: 4.8,
    rebalanceCycleMonths: 6,
    xaiSummary:
      "원금 손실 가능성을 낮추는 데 중점을 둔 배분 예시입니다. 예적금, 파킹, 단기채 비중을 높이고 주식형 자산은 제한적으로 편입합니다.",
    rationaleFactors: [
      "원금 손실 가능성이 낮은 편인 자산을 우선 배치하되 상품별 조건 확인 필요",
      "단기채와 현금성 상품으로 기한 리스크 관리",
      "6개월 단위 점검으로 과도한 거래를 방지",
    ],
    allocations: [
      {
        key: "cash",
        label: "예적금",
        weight: 35,
        color: "#16a34a",
        candidates: [
          {
            name: "고금리 파킹통장",
            category: "비상/대기 자금",
            reason: "입출금 자유도와 단기 이자 수익",
            query: "고금리 파킹통장",
          },
        ],
      },
      {
        key: "deposit",
        label: "예적금",
        weight: 30,
        color: "#0891b2",
        candidates: [
          {
            name: "청년 우대 적금",
            category: "정기 적립",
            reason: "정해진 목표 기한까지 강제 저축 효과",
            query: "청년 우대 적금",
          },
        ],
      },
      {
        key: "bond",
        label: "단기채 ETF",
        weight: 25,
        color: "#7c3aed",
        candidates: [
          {
            name: "KODEX 단기채권PLUS",
            category: "단기 채권",
            reason: "낮은 변동성의 이자형 자산",
            query: "KODEX 단기채권PLUS",
          },
        ],
      },
      {
        key: "global-equity",
        label: "글로벌 주식 ETF",
        weight: 10,
        color: "#2563eb",
        candidates: [
          {
            name: "TIGER 미국S&P500",
            category: "최소 성장 노출",
            reason: "물가상승률 방어를 위한 제한적 성장 자산",
            query: "TIGER 미국S&P500",
          },
        ],
      },
    ],
  },
};

type AllocationGroupKey = "stock-etf" | "deposit-savings" | "bond";

const allocationGroupMeta: Record<AllocationGroupKey, Pick<PortfolioAllocation, "label" | "color">> = {
  "stock-etf": {
    label: "주식/ETF",
    color: "#2563eb",
  },
  "deposit-savings": {
    label: "예금/적금",
    color: "#16a34a",
  },
  bond: {
    label: "채권",
    color: "#7c3aed",
  },
};

const allocationGroupOrder: AllocationGroupKey[] = ["stock-etf", "deposit-savings", "bond"];

const portfolioTargets: Record<
  PortfolioModel["riskProfile"],
  {
    expectedReturnPercent: number;
    weights: Record<AllocationGroupKey, number>;
  }
> = {
  aggressive: {
    expectedReturnPercent: 8.5,
    weights: {
      "stock-etf": 70,
      "deposit-savings": 10,
      bond: 20,
    },
  },
  neutral: {
    expectedReturnPercent: 6.0,
    weights: {
      "stock-etf": 50,
      "deposit-savings": 10,
      bond: 40,
    },
  },
  stable: {
    expectedReturnPercent: 4.2,
    weights: {
      "stock-etf": 10,
      "deposit-savings": 30,
      bond: 60,
    },
  },
};

function getAllocationGroupKey(allocation: PortfolioAllocation): AllocationGroupKey {
  if (allocation.key === "bond") return "bond";
  if (allocation.key === "cash" || allocation.key === "deposit") return "deposit-savings";

  return "stock-etf";
}

function groupAllocations(
  allocations: PortfolioAllocation[],
  weights: Record<AllocationGroupKey, number>,
): PortfolioAllocation[] {
  const grouped = new Map<AllocationGroupKey, PortfolioAllocation>();

  for (const allocation of allocations) {
    const groupKey = getAllocationGroupKey(allocation);
    const existing = grouped.get(groupKey);

    if (existing) {
      existing.candidates = [...existing.candidates, ...allocation.candidates];
      continue;
    }

    grouped.set(groupKey, {
      key: groupKey,
      label: allocationGroupMeta[groupKey].label,
      weight: weights[groupKey],
      color: allocationGroupMeta[groupKey].color,
      candidates: [...allocation.candidates],
    });
  }

  return allocationGroupOrder.flatMap((groupKey) => {
    const allocation = grouped.get(groupKey);

    return [
      allocation ?? {
        key: groupKey,
        label: allocationGroupMeta[groupKey].label,
        weight: weights[groupKey],
        color: allocationGroupMeta[groupKey].color,
        candidates: [],
      },
    ];
  });
}

function normalizePortfolioModel(model: PortfolioModel): PortfolioModel {
  const target = portfolioTargets[model.riskProfile];

  return {
    ...model,
    expectedReturnPercent: target.expectedReturnPercent,
    allocations: groupAllocations(model.allocations, target.weights),
  };
}

export const portfolioModels: Record<PortfolioModel["riskProfile"], PortfolioModel> = {
  aggressive: normalizePortfolioModel(rawPortfolioModels.aggressive),
  neutral: normalizePortfolioModel(rawPortfolioModels.neutral),
  stable: normalizePortfolioModel(rawPortfolioModels.stable),
};
