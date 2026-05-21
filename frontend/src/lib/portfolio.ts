import type { Goal, GoalType } from "./goalsStore";
import { inferGoalType } from "./goalsStore";

export type AssetClass = "주식 ETF" | "채권 ETF" | "예적금" | "현금";

export type AllocationItem = {
  name: AssetClass;
  pct: number;
  color: string;
  desc: string;
};

export type Holding = {
  ticker: string;
  name: string;
  weight: number;
  reason: string;
};

// Per goal-type: asset allocation, expected annual return, risk label
type Profile = {
  label: string;
  riskLabel: string;
  expectedReturn: number; // % (annual)
  allocation: { 주식: number; 채권: number; 예적금: number; 현금: number };
  holdings: Record<AssetClass, Holding[]>;
};

const colors = {
  주식: "var(--chart-1)",
  채권: "var(--chart-2)",
  예적금: "var(--chart-3)",
  현금: "var(--chart-4)",
};

// Holding pools by category
const STOCK_BROAD: Holding[] = [
  {
    ticker: "360750",
    name: "TIGER 미국S&P500",
    weight: 40,
    reason: "미국 대형주 분산 · 장기 우상향",
  },
  { ticker: "069500", name: "KODEX 200", weight: 35, reason: "국내 대표 우량주 · 낮은 보수" },
  { ticker: "381170", name: "TIGER 미국나스닥100", weight: 25, reason: "글로벌 성장 테크 노출" },
];
const STOCK_TDF: Holding[] = [
  { ticker: "446770", name: "KODEX TDF2050액티브", weight: 60, reason: "은퇴 시점 자동 리밸런싱" },
  { ticker: "360750", name: "TIGER 미국S&P500", weight: 40, reason: "글로벌 핵심 자산" },
];
const BOND_LONG: Holding[] = [
  {
    ticker: "365780",
    name: "KODEX 국고채30년액티브",
    weight: 60,
    reason: "안정적 이자수익 · 금리 하락 수혜",
  },
  { ticker: "308620", name: "KODEX 미국채10년선물(H)", weight: 40, reason: "환헤지 · 분산 효과" },
];
const BOND_SHORT: Holding[] = [
  { ticker: "153130", name: "KODEX 단기채권", weight: 100, reason: "단기 만기 · 변동성 최소" },
];
const SAVINGS: Holding[] = [
  { ticker: "KB", name: "KB Star 정기예금 12개월", weight: 60, reason: "연 3.6% · 원금 보장" },
  { ticker: "TOSS", name: "토스뱅크 자유적금", weight: 40, reason: "연 3.5% · 자유로운 입출금" },
];
const SAVINGS_PARK: Holding[] = [
  { ticker: "TOSS", name: "토스뱅크 파킹통장", weight: 70, reason: "연 2.3% · 즉시 인출" },
  { ticker: "KAKAO", name: "카카오뱅크 세이프박스", weight: 30, reason: "비상금 즉시 인출" },
];
const CASH: Holding[] = [
  { ticker: "CMA", name: "CMA 계좌", weight: 100, reason: "수시 입출금 · 일복리 이자" },
];

const profiles: Record<GoalType, Profile> = {
  emergency: {
    label: "비상금형",
    riskLabel: "초저위험 · 원금보장",
    expectedReturn: 2.8,
    allocation: { 주식: 0, 채권: 0, 예적금: 80, 현금: 20 },
    holdings: {
      "주식 ETF": [],
      "채권 ETF": [],
      예적금: SAVINGS_PARK,
      현금: CASH,
    },
  },
  short: {
    label: "단기 안정형",
    riskLabel: "저위험 · 원금보존 우선",
    expectedReturn: 3.5,
    allocation: { 주식: 0, 채권: 30, 예적금: 60, 현금: 10 },
    holdings: {
      "주식 ETF": [],
      "채권 ETF": BOND_SHORT,
      예적금: SAVINGS,
      현금: CASH,
    },
  },
  mid: {
    label: "중기 균형형",
    riskLabel: "중저위험 · 안정적 성장",
    expectedReturn: 4.6,
    allocation: { 주식: 25, 채권: 35, 예적금: 30, 현금: 10 },
    holdings: {
      "주식 ETF": STOCK_BROAD,
      "채권 ETF": BOND_SHORT,
      예적금: SAVINGS,
      현금: CASH,
    },
  },
  long: {
    label: "장기 성장형",
    riskLabel: "중위험 · 중수익",
    expectedReturn: 5.8,
    allocation: { 주식: 45, 채권: 25, 예적금: 20, 현금: 10 },
    holdings: {
      "주식 ETF": STOCK_BROAD,
      "채권 ETF": BOND_LONG,
      예적금: SAVINGS,
      현금: CASH,
    },
  },
  ultraLong: {
    label: "초장기 공격형",
    riskLabel: "중고위험 · 인플레 헤지",
    expectedReturn: 7.2,
    allocation: { 주식: 70, 채권: 25, 예적금: 5, 현금: 0 },
    holdings: {
      "주식 ETF": STOCK_TDF,
      "채권 ETF": BOND_LONG,
      예적금: SAVINGS,
      현금: [],
    },
  },
};

export type PortfolioPlan = {
  goal: Goal | null;
  goalType: GoalType;
  profileLabel: string;
  riskLabel: string;
  expectedReturn: number;
  monthlyKRWMan: number; // 만원
  allocation: AllocationItem[];
  holdings: Record<AssetClass, Holding[]>;
};

// Pick the highest-priority active goal (not yet 100% saved). Tie → shortest months.
export function pickPrimaryGoal(goals: Goal[]): Goal | null {
  const active = goals.filter((g) => g.saved < g.target);
  if (active.length === 0) return goals[0] ?? null;
  const order = { 높음: 0, 보통: 1, 낮음: 2 } as const;
  return [...active].sort((a, b) => {
    const p = order[a.priority] - order[b.priority];
    if (p !== 0) return p;
    return a.months - b.months;
  })[0];
}

// Required monthly contribution with compound annual return r (decimal), n months
// FV = PV*(1+r/12)^n + PMT * (((1+r/12)^n - 1) / (r/12))
// Solve for PMT given target FV and current saved (PV)
function requiredMonthly(
  targetMan: number,
  savedMan: number,
  months: number,
  annualReturn: number,
): number {
  const r = annualReturn / 100;
  const i = r / 12;
  const n = Math.max(1, months);
  if (i === 0) {
    return Math.max(0, (targetMan - savedMan) / n);
  }
  const factor = Math.pow(1 + i, n);
  const fvOfPV = savedMan * factor;
  const remain = targetMan - fvOfPV;
  if (remain <= 0) return 0;
  const annuityFactor = (factor - 1) / i;
  return remain / annuityFactor;
}

export function buildPortfolio(goals: Goal[]): PortfolioPlan {
  const primary = pickPrimaryGoal(goals);
  const goalType: GoalType = primary ? inferGoalType(primary) : "long";
  const p = profiles[goalType];

  const monthly = primary
    ? requiredMonthly(primary.target, primary.saved, primary.months, p.expectedReturn)
    : 0;
  const monthlyRounded = Math.max(1, Math.ceil(monthly));

  const allocation: AllocationItem[] = (
    [
      {
        name: "주식 ETF" as AssetClass,
        pct: p.allocation.주식,
        color: colors.주식,
        desc: "장기 성장",
      },
      {
        name: "채권 ETF" as AssetClass,
        pct: p.allocation.채권,
        color: colors.채권,
        desc: "안정적 수익",
      },
      {
        name: "예적금" as AssetClass,
        pct: p.allocation.예적금,
        color: colors.예적금,
        desc: "원금 보장",
      },
      { name: "현금" as AssetClass, pct: p.allocation.현금, color: colors.현금, desc: "비상 자금" },
    ] as AllocationItem[]
  ).filter((a) => a.pct > 0);

  return {
    goal: primary,
    goalType,
    profileLabel: p.label,
    riskLabel: p.riskLabel,
    expectedReturn: p.expectedReturn,
    monthlyKRWMan: monthlyRounded,
    allocation,
    holdings: p.holdings,
  };
}

export function reasonsFor(plan: PortfolioPlan): { title: string; desc: string }[] {
  const g = plan.goal;
  const horizon = g ? `${g.months}개월` : "장기";
  const target = g ? `${g.target.toLocaleString()}만원` : "목표 금액";

  const base: Record<GoalType, { title: string; desc: string }[]> = {
    emergency: [
      {
        title: "비상금은 '언제든 인출' 이 최우선",
        desc: "비상금은 수익보다 즉시성·원금보장이 중요해요. 그래서 파킹통장·CMA 위주로 구성했어요.",
      },
      {
        title: "주식·채권은 0%",
        desc: "단기 가격 변동으로 정작 필요할 때 손실 상태일 위험을 차단했어요.",
      },
      {
        title: `${horizon} 안에 ${target} 마련`,
        desc: "월급의 3~6개월치를 목표로 빠르게 모으는 데 최적화된 구성이에요.",
      },
    ],
    short: [
      {
        title: `${horizon} 안에 써야 할 돈이에요`,
        desc: "1~2년 내 사용 예정이라 변동성 큰 자산은 제외했어요. 예적금 60% + 단기채권 30%로 안정성 확보.",
      },
      {
        title: "주식 ETF 비중 0%",
        desc: "단기엔 시장 하락 회복 시간이 부족해 손실 위험을 원천 차단했어요.",
      },
      {
        title: "현금 10% 보유",
        desc: "예상치 못한 지출이나 더 나은 예금 상품으로 갈아탈 유연성을 확보해요.",
      },
    ],
    mid: [
      {
        title: `${horizon} 중기 목표예요`,
        desc: "2~5년 기간에는 안정성과 성장을 균형있게 가져가는 게 최적이에요. 채권 35% + 예적금 30%로 하방 방어.",
      },
      {
        title: "주식 ETF 25%로 추가 수익 노려요",
        desc: "전체의 1/4만 변동 자산으로 두고, 시장 상승 시 추가 수익을 확보해요.",
      },
      {
        title: `복리 ${plan.expectedReturn}% 기준 계산`,
        desc: `매월 ${plan.monthlyKRWMan.toLocaleString()}만원을 모으면 ${horizon} 뒤 ${target} 달성 가능해요.`,
      },
    ],
    long: [
      {
        title: `${horizon} 장기 투자 가능`,
        desc: "5년 이상이라 단기 변동보다 장기 수익률이 중요해요. 그래서 주식 ETF 45%로 성장 자산을 확보했어요.",
      },
      {
        title: "채권·예적금 45%로 균형",
        desc: "변동성이 큰 해엔 안전 자산이 손실을 완충해줘요. 적립식 매수와 결합하면 평균 매입단가가 낮아져요.",
      },
      {
        title: "ETF 중심 분산투자",
        desc: "개별 종목 리스크 없이 시장 전체 성장에 베팅. 초보자에게 적합해요.",
      },
      {
        title: `복리 ${plan.expectedReturn}% 기준 계산`,
        desc: `매월 ${plan.monthlyKRWMan.toLocaleString()}만원이면 ${horizon} 뒤 ${target} 도달 예상.`,
      },
    ],
    ultraLong: [
      {
        title: `${horizon} 초장기 자금이에요`,
        desc: "15년 이상이라 인플레이션이 가장 큰 적이에요. 주식 ETF 70%로 실질 구매력을 지켜요.",
      },
      {
        title: "TDF로 자동 리밸런싱",
        desc: "은퇴 시점이 다가올수록 자동으로 채권 비중이 높아져요. 신경 안 써도 돼요.",
      },
      {
        title: "복리의 마법 활용",
        desc: `${plan.expectedReturn}% 복리로 ${horizon}이면 원금의 수 배가 돼요. 일찍 시작할수록 월 부담이 급감해요.`,
      },
      {
        title: "예적금 비중 최소화",
        desc: "장기간 예적금은 인플레이션을 못 따라가요. 비상금만 별도로 두세요.",
      },
    ],
  };

  return base[plan.goalType];
}
