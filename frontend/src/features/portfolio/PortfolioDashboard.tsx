import {
  X,
  GraduationCap,
  Lightbulb,
  Network,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getGoalLabel } from "../../constants/goals";
import { calculateStockAssetMetrics } from "../../lib/assetCalculations";
import { computeSimulationStats } from "../../lib/finance";
import { formatManwon } from "../../lib/format";
import type { AssetPortfolio, FinancialInputs, PortfolioModel } from "../../types/domain";


type PortfolioDashboardProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  assetPortfolio: AssetPortfolio;
  onRebalanceNow: () => void;
  onReset: () => void;
};

type AllocationSummary = {
  key: string;
  label: string;
  weight: number;
  color: string;
};

type RebalanceDeviation = {
  key: string;
  label: string;
  targetWeight: number;
  actualWeight: number;
  diff: number;
};

const REBALANCE_SUPPRESS_UNTIL_KEY = "moneyPilotRebalanceSuppressUntil";

export function PortfolioDashboard({ inputs, model, assetPortfolio, onRebalanceNow, onReset }: PortfolioDashboardProps) {
  const [showMptInfo, setShowMptInfo] = useState(false);
  const [rebalanceDismissed, setRebalanceDismissed] = useState(false);
  const [rebalanceSuppressUntil, setRebalanceSuppressUntil] = useState(() => getStoredRebalanceSuppressUntil());
  const simulation = useMemo(() => computeSimulationStats(inputs, model), [inputs, model]);
  const xaiExplanation = useMemo(() => getPortfolioXaiExplanation(model.riskProfile), [model.riskProfile]);
  const assetAllocations = useMemo(
    () => buildEnteredAssetAllocations(assetPortfolio, model.allocations),
    [assetPortfolio, model.allocations],
  );
  const rebalanceDeviations = useMemo(
    () => getRebalanceDeviations(model.allocations, assetAllocations),
    [assetAllocations, model.allocations],
  );
  const shouldShowRebalanceModal =
    rebalanceDeviations.length > 0 && !rebalanceDismissed && Date.now() >= rebalanceSuppressUntil;

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-950 px-5 py-6 pb-24">
      <Card className="mb-6">
        <div className="mb-1.5 flex items-center justify-between">
          <button type="button" className="text-xs text-slate-400 underline hover:text-slate-100" onClick={onReset}>
            조건 변경
          </button>
        </div>
        <h2 className="mb-1 text-lg font-black text-slate-100">
          {inputs.goalYears}년 뒤 {inputs.goalType === "other" ? (inputs.customGoalLabel || "기타") : getGoalLabel(inputs.goalType)}
        </h2>
        <div className="mb-2 mt-2.5 h-2 w-full rounded-full bg-slate-800">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700"
            style={{ width: `${simulation.progressPercent}%` }}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <div className="text-right text-[11px] font-bold text-slate-400">
            ({formatManwon(inputs.currentAssetsManwon)}만 / {formatManwon(inputs.goalAmountManwon)}만원)
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-100">
            <Network size={15} className="text-blue-400" />
            포트폴리오 구성 비중
          </h3>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-2 py-1 text-[9px] font-extrabold text-slate-100 transition hover:bg-slate-700"
            onClick={() => setShowMptInfo((current) => !current)}
          >
            포트폴리오 추천 기준이 궁금하다면?
          </button>
        </div>

        <div className="mb-6 rounded-[28px] border border-slate-700 bg-slate-900 p-5 shadow-sm">
          <AllocationStack title="추천 비중" allocations={model.allocations} />
          <AllocationStack title="내 자산 기준 비중" allocations={assetAllocations} emptyMessage="입력된 자산이 없습니다." />
        </div>

        <div className="mb-6 rounded-xl border border-blue-800 bg-blue-950/40 p-4">
          <p className="mb-1 text-[10px] font-extrabold text-blue-300">설명 가능한 AI 추천 근거</p>
          <h4 className="mb-2 text-sm font-black text-slate-100">{xaiExplanation.title}</h4>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-300">{xaiExplanation.summary}</p>
          <div className="space-y-2">
            {xaiExplanation.reasons.map((reason) => (
              <div key={reason.title} className="rounded-lg bg-slate-900 p-3">
                <p className="mb-1 text-[11px] font-extrabold text-slate-100">{reason.title}</p>
                <p className="text-[10px] leading-relaxed text-slate-400">{reason.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-[10px] font-extrabold text-slate-100">
              <Network size={12} />
              부문별 적합 금융상품 후보군
            </h4>
          </div>
          <div className="space-y-3">
            {model.allocations.map((allocation) => (
              <div key={allocation.key}>
                <p className="mb-1 text-[10px] font-black text-slate-200">{allocation.label}</p>
                <div className="space-y-1.5">
                  {allocation.candidates.map((candidate) => (
                    <div key={candidate.name} className="rounded-lg bg-slate-800 p-2 text-[10px] text-slate-300">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-100">{candidate.name}</strong>
                        <span className="rounded bg-blue-800 px-1.5 py-0.5 font-bold text-blue-100">{candidate.category}</span>
                      </div>
                      <p className="mt-1 leading-relaxed text-slate-300">{candidate.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </Card>

      {showMptInfo ? (
        <div className="fixed inset-0 z-40 bg-slate-900/20 flex items-end backdrop-blur-[1px]" onClick={() => setShowMptInfo(false)}>
          <div
            className="no-scrollbar w-full max-h-[75vh] overflow-y-auto rounded-t-2xl border border-b-0 border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
                <Lightbulb size={16} className="text-blue-400" />
                왜 MPT 기반 배분인가요?
              </h4>
              <button
                type="button"
                aria-label="추천 기준 닫기"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => setShowMptInfo(false)}
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              상관관계가 낮은 자산을 섞어 목표 수익률 대비 변동성을 낮추는 방식입니다. 현재는 목데이터 기반이며, 이후 실제 상품/가격 데이터와 연결합니다.
            </p>
            <div className="rounded-xl border border-blue-800 bg-blue-950/70 p-4">
              <h4 className="mb-2 flex items-center gap-1 text-xs font-extrabold text-blue-200">
                <GraduationCap size={14} />
                AI 포트폴리오 추천 엔진 브리핑
              </h4>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-300">{model.xaiSummary}</p>
              <ul className="space-y-1 rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-300">
                {model.rationaleFactors.map((factor) => (
                  <li key={factor}>• {factor}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {shouldShowRebalanceModal ? (
        <RebalanceModal
          deviations={rebalanceDeviations}
          onClose={() => setRebalanceDismissed(true)}
          onSuppressForWeek={() => {
            const nextSuppressUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
            localStorage.setItem(REBALANCE_SUPPRESS_UNTIL_KEY, String(nextSuppressUntil));
            setRebalanceSuppressUntil(nextSuppressUntil);
            setRebalanceDismissed(true);
          }}
          onRebalanceNow={() => {
            setRebalanceDismissed(true);
            onRebalanceNow();
          }}
        />
      ) : null}

    </main>
  );
}

function RebalanceModal({
  deviations,
  onClose,
  onSuppressForWeek,
  onRebalanceNow,
}: {
  deviations: RebalanceDeviation[];
  onClose: () => void;
  onSuppressForWeek: () => void;
  onRebalanceNow: () => void;
}) {
  const mainDeviation = deviations.reduce((selected, current) =>
    Math.abs(current.diff) > Math.abs(selected.diff) ? current : selected,
  );
  const overweight = deviations.filter((deviation) => deviation.diff > 0);
  const underweight = deviations.filter((deviation) => deviation.diff < 0);

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-slate-950/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bottom-sheet-enter max-h-[82vh] w-full max-w-full overflow-y-auto rounded-2xl border border-blue-800 bg-slate-950 p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-extrabold text-blue-300">리밸런싱 권유 알림</p>
            <h3 className="text-lg font-black text-slate-100">포트폴리오 균형이 깨졌어요!</h3>
          </div>
          <button
            type="button"
            aria-label="리밸런싱 알림 닫기"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-bold leading-relaxed text-slate-100">
            {mainDeviation.label} 비중이 목표 {mainDeviation.targetWeight}% 대비 현재 {mainDeviation.actualWeight}%로{" "}
            {Math.abs(mainDeviation.diff)}%p 이탈했습니다.
          </p>
          {overweight.length > 0 ? (
            <p className="mb-2 text-xs leading-relaxed text-slate-300">
              비중이 커진 {formatDeviationLabels(overweight)}은 일부 차익실현을 검토해볼 수 있습니다.
            </p>
          ) : null}
          {underweight.length > 0 ? (
            <p className="text-xs leading-relaxed text-slate-300">
              비중이 낮아진 {formatDeviationLabels(underweight)}은 추가 매수 또는 신규 납입 배분 후보입니다.
            </p>
          ) : null}
        </div>

        <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
          AI는 현재 비중이 추천 비중에서 ±10%p 이상 벗어난 자산부문을 기준으로 균형 회복을 권유합니다.
          실제 매수/매도 후 자산현황에서 변동사항을 업데이트해주세요.
        </p>

        <div className="grid gap-2">
          <Button className="w-full" variant="secondary" onClick={onRebalanceNow}>
            지금 리밸런싱 하기
          </Button>
          <Button className="w-full" variant="ghost" onClick={onClose}>
            나중에 하기
          </Button>
          <Button className="w-full" variant="ghost" onClick={onSuppressForWeek}>
            1주일 이내에 더 이상 알림받지 않기
          </Button>
        </div>
      </div>
    </div>
  );
}

function AllocationStack({
  title,
  allocations,
  emptyMessage,
}: {
  title: string;
  allocations: AllocationSummary[];
  emptyMessage?: string;
}) {
  const hasAllocations = allocations.some((allocation) => allocation.weight > 0);

  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 text-[10px] font-extrabold text-slate-400">{title}</p>
      {hasAllocations ? (
        <>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-800">
            {allocations.map((allocation) => (
              <div
                key={allocation.key}
                className="h-full"
                style={{ width: `${allocation.weight}%`, backgroundColor: allocation.color }}
                title={`${allocation.label} ${allocation.weight}%`}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {allocations.map((allocation) => (
              <div key={allocation.key} className="flex items-center gap-2 text-[11px] font-bold text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocation.color }} />
                <span className="min-w-0 flex-1 truncate">{allocation.label}</span>
                <span className="shrink-0 text-slate-100">{allocation.weight}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="rounded-xl bg-slate-800 p-3 text-center text-xs font-semibold text-slate-400">{emptyMessage}</p>
      )}
    </div>
  );
}

function buildEnteredAssetAllocations(portfolio: AssetPortfolio, modelAllocations: AllocationSummary[]): AllocationSummary[] {
  const stockValue = portfolio.stockAssets.reduce((total, asset) => {
    const metrics = calculateStockAssetMetrics(asset);
    return total + (metrics.currentValue ?? metrics.purchaseValue);
  }, 0);
  const depositValue = portfolio.depositAssets.reduce((total, asset) => total + asset.currentAmount, 0);
  const bondValue = portfolio.bondAssets.reduce((total, asset) => total + asset.currentValue, 0);
  const totalValue = stockValue + depositValue + bondValue;
  const valueByKey: Record<string, number> = {
    "stock-etf": stockValue,
    "deposit-savings": depositValue,
    bond: bondValue,
  };

  return modelAllocations.map((allocation) => ({
    key: allocation.key,
    label: allocation.label,
    color: allocation.color,
    weight: totalValue > 0 ? Math.round(((valueByKey[allocation.key] ?? 0) / totalValue) * 100) : 0,
  }));
}

function getRebalanceDeviations(targetAllocations: AllocationSummary[], actualAllocations: AllocationSummary[]) {
  const actualByKey = new Map(actualAllocations.map((allocation) => [allocation.key, allocation]));

  return targetAllocations
    .map((target) => {
      const actualWeight = actualByKey.get(target.key)?.weight ?? 0;
      const diff = actualWeight - target.weight;

      return {
        key: target.key,
        label: target.label,
        targetWeight: target.weight,
        actualWeight,
        diff,
      };
    })
    .filter((deviation) => Math.abs(deviation.diff) >= 10)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

function formatDeviationLabels(deviations: RebalanceDeviation[]) {
  return deviations.map((deviation) => deviation.label).join(", ");
}

function getStoredRebalanceSuppressUntil() {
  const storedValue = localStorage.getItem(REBALANCE_SUPPRESS_UNTIL_KEY);
  const suppressUntil = storedValue ? Number(storedValue) : 0;

  return Number.isFinite(suppressUntil) ? suppressUntil : 0;
}

function getPortfolioXaiExplanation(riskProfile: PortfolioModel["riskProfile"]) {
  if (riskProfile === "aggressive") {
    return {
      title: "공격투자형: 사회초년생의 인적 자본을 반영한 성장 중심 배분",
      summary:
        "위험자산 비중을 높인 이유는 현재 금융자산보다 앞으로 벌어들일 근로소득, 즉 인적 자본의 가치가 더 크다고 보기 때문입니다.",
      reasons: [
        {
          title: "보디와 머턴의 생애주기 인적 자본 이론",
          body:
            "사회초년생의 안정적인 근로소득은 채권적 자산처럼 작동합니다. 따라서 전체 자산 관점에서는 금융 포트폴리오 안에서 주식형 ETF 비중을 높여 장기 복리 수익률을 추구할 수 있습니다.",
        },
        {
          title: "장기 근로기간이 변동성 완충 장치",
          body:
            "단기 급락이 발생해도 남은 근로기간 동안 소득 유입이 이어지므로 저점 분할 매수와 회복 시간을 확보할 수 있습니다.",
        },
      ],
    };
  }

  if (riskProfile === "neutral") {
    return {
      title: "위험중립형: 현대 포트폴리오 이론 기반의 균형 배분",
      summary:
        "성장성과 안정성을 함께 고려해 주식, 채권, 현금을 분산 배치한 표준형 모델입니다.",
      reasons: [
        {
          title: "마코위츠의 현대 포트폴리오 이론",
          body:
            "상관관계가 다른 자산을 함께 보유하면 같은 기대수익률에서도 변동성을 낮출 수 있습니다. 주식과 채권을 함께 배치해 효율적 투자선에 가까운 균형을 추구합니다.",
        },
        {
          title: "브린슨 연구의 자산배분 중요성 반영",
          body:
            "장기 성과의 핵심은 개별 종목 선택보다 자산군 배분에 있다는 연구 결과를 반영해, 특정 종목보다 자산군 비중 관리에 초점을 둡니다.",
        },
      ],
    };
  }

  return {
    title: "안정지향형: 원금 방어와 실질 구매력 보존의 균형",
    summary:
      "안전자산 중심으로 손실 가능성을 낮추되, 인플레이션에 따른 구매력 하락을 방어하기 위해 최소한의 성장 자산을 포함합니다.",
    reasons: [
      {
        title: "어빙 피셔의 실질금리 관점",
        body:
          "예적금만 보유하면 명목 원금은 지켜도 물가 상승으로 실제 구매력이 줄어들 수 있습니다. 따라서 국채와 예금 중심으로 안정성을 확보하면서 일부 주식형 자산을 편입합니다.",
      },
      {
        title: "극단적 변동성 회피를 위한 방어적 구조",
        body:
          "대부분의 비중은 국채와 확정금리형 자산에 두고, 제한적인 성장 자산만 배치해 손실 가능성과 물가상승 위험을 동시에 관리합니다.",
      },
    ],
  };
}
