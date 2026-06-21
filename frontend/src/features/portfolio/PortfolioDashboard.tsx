import {
  AlertTriangle,
  Network,
  Settings2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getGoalLabel } from "../../constants/goals";
import { computeSimulationStats } from "../../lib/finance";
import { formatManwon } from "../../lib/format";
import type { AssetValuation, FinancialInputs, PortfolioAllocation, PortfolioModel } from "../../types/domain";

type PortfolioDashboardProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  assetValuation: AssetValuation;
  excludedCandidates: string[];
  onToggleCandidate: (candidateName: string) => void;
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

type GoalFeasibilityStatus = "achieved" | "comfortable" | "on-track" | "tight" | "stretched";

type GoalFeasibility = {
  months: number;
  monthlyInvestableManwon: number;
  requiredMonthlyInvestmentManwon: number;
  coverageRatio: number;
  status: GoalFeasibilityStatus;
  statusLabel: string;
  horizonLabel: string;
};

const REBALANCE_SUPPRESS_UNTIL_KEY = "moneyPilotRebalanceSuppressUntil";

export function PortfolioDashboard({
  inputs,
  model,
  assetValuation,
  excludedCandidates,
  onToggleCandidate,
  onRebalanceNow,
  onReset,
}: PortfolioDashboardProps) {
  const [rebalanceDismissed, setRebalanceDismissed] = useState(false);
  const [rebalanceSuppressUntil, setRebalanceSuppressUntil] = useState(() => getStoredRebalanceSuppressUntil());
  const [candidateEditorOpen, setCandidateEditorOpen] = useState(false);
  const simulation = useMemo(() => computeSimulationStats(inputs, model), [inputs, model]);
  const recommendedAllocations = useMemo(
    () => normalizeIncludedAllocations(model.allocations, excludedCandidates),
    [excludedCandidates, model.allocations],
  );
  const explanationModel = useMemo(
    () => ({
      ...model,
      allocations: recommendedAllocations.length > 0 ? recommendedAllocations : model.allocations,
    }),
    [model, recommendedAllocations],
  );
  const feasibility = useMemo(() => getGoalFeasibility(inputs), [inputs]);
  const decisionExplanation = useMemo(
    () => getPortfolioDecisionExplanation(inputs, explanationModel, feasibility),
    [explanationModel, feasibility, inputs],
  );
  const rebalanceDeviations = useMemo(
    () => getRebalanceDeviations(recommendedAllocations, assetValuation.allocations),
    [assetValuation.allocations, recommendedAllocations],
  );
  const includedCandidateCount = recommendedAllocations.reduce(
    (count, allocation) => count + allocation.candidates.length,
    0,
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
        </div>

        <div className="mb-6 rounded-[28px] border border-slate-700 bg-slate-900 p-5 shadow-sm">
          <AllocationStack
            title="추천 비중"
            allocations={recommendedAllocations}
            emptyMessage="추가된 추천 후보가 없습니다."
          />
          <AllocationStack
            title="내 자산 기준 비중"
            allocations={assetValuation.allocations}
            emptyMessage="입력된 자산이 없습니다."
          />
        </div>

        <div className="mb-6 rounded-xl border border-blue-800 bg-blue-950/40 p-4">
          <p className="mb-1 text-[10px] font-extrabold text-blue-300">추천은 이렇게 계산했어요</p>
          <h4 className="mb-2 text-sm font-black text-slate-100">{decisionExplanation.title}</h4>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-300">{decisionExplanation.summary}</p>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <MetricTile label="월 투자 여력" value={`${formatManwon(feasibility.monthlyInvestableManwon)}만원`} />
            <MetricTile label="목표 달성 최소 월 투자금" value={`${formatManwon(feasibility.requiredMonthlyInvestmentManwon)}만원`} />
            <MetricTile label="달성 여력 비율" value={formatCoverageRatio(feasibility.coverageRatio)} />
          </div>

          <div className="space-y-2">
            {decisionExplanation.reasons.map((reason) => (
              <div key={reason.title} className="rounded-lg bg-slate-900 p-3">
                <p className="mb-1 text-[11px] font-extrabold text-slate-100">{reason.title}</p>
                <p className="text-[10px] leading-relaxed text-slate-400">{reason.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-blue-800/70 pt-4">
            <p className="mb-2 text-[11px] font-extrabold text-blue-200">추천 기준 요약</p>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-300">{model.xaiSummary}</p>
            <ul className="space-y-1 rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-300">
              {model.rationaleFactors.map((factor) => (
                <li key={factor}>• {factor}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-[10px] font-extrabold text-slate-100">
              <Network size={12} />
              부문별 적합 금융상품 후보군
            </h4>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-extrabold text-slate-200 shadow-sm transition hover:border-blue-500 hover:text-blue-200"
              onClick={() => setCandidateEditorOpen(true)}
            >
              <Settings2 size={11} />
              편집
            </button>
          </div>
          {includedCandidateCount > 0 ? (
            <div className="space-y-3">
              {recommendedAllocations.map((allocation) => (
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
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-amber-700 bg-amber-950/40 p-3 text-amber-100">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-extrabold">모든 추천 종목이 제외되었습니다.</p>
                <p className="mt-0.5 text-[9px] leading-relaxed text-amber-200">편집에서 후보 종목을 다시 추가해 주세요.</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {candidateEditorOpen ? (
        <CandidateEditor
          allocations={model.allocations}
          excludedCandidates={excludedCandidates}
          onClose={() => setCandidateEditorOpen(false)}
          onToggleCandidate={onToggleCandidate}
        />
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

function CandidateEditor({
  allocations,
  excludedCandidates,
  onClose,
  onToggleCandidate,
}: {
  allocations: PortfolioAllocation[];
  excludedCandidates: string[];
  onClose: () => void;
  onToggleCandidate: (candidateName: string) => void;
}) {
  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 pb-4 pt-9">
        <div>
          <p className="mb-0.5 text-[10px] font-bold text-blue-300">추천 포트폴리오</p>
          <h3 className="text-lg font-black text-slate-100">포트폴리오 종목 편집</h3>
        </div>
        <button
          type="button"
          aria-label="포트폴리오 종목 편집 닫기"
          className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 pb-8">
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-900 bg-blue-950/40 p-3">
          <Settings2 size={15} className="mt-0.5 shrink-0 text-blue-300" />
          <p className="text-[10px] leading-relaxed text-blue-100">
            추천 후보를 직접 추가하거나 제외할 수 있습니다.
          </p>
        </div>

        <div className="space-y-5">
          {allocations.map((allocation) => {
            const includedCount = allocation.candidates.filter(
              (candidate) => !excludedCandidates.includes(candidate.name),
            ).length;

            return (
              <section key={allocation.key}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocation.color }} />
                    <h4 className="text-xs font-extrabold text-slate-100">{allocation.label}</h4>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500">
                    {includedCount}/{allocation.candidates.length} 추가
                  </span>
                </div>

                <div className="space-y-2">
                  {allocation.candidates.map((candidate) => {
                    const excluded = excludedCandidates.includes(candidate.name);

                    return (
                      <div key={candidate.name} className="rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <strong className="text-xs text-slate-100">{candidate.name}</strong>
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold text-slate-300">
                                {candidate.category}
                              </span>
                            </div>
                            <p className="text-[9px] leading-relaxed text-slate-400">{candidate.reason}</p>
                          </div>
                          <button
                            type="button"
                            aria-pressed={!excluded}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-extrabold transition ${
                              excluded
                                ? "border border-slate-700 bg-slate-800 text-slate-400 hover:border-blue-500 hover:bg-blue-950 hover:text-blue-200"
                                : "bg-blue-600 text-white shadow-sm hover:bg-blue-500"
                            }`}
                            onClick={() => onToggleCandidate(candidate.name)}
                          >
                            {excluded ? "제외됨" : "추가됨"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
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
            {mainDeviation.label} 비중이 현재 {mainDeviation.actualWeight}%로, 목표 {mainDeviation.targetWeight}% 대비{" "}
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
          현재 비중이 추천 비중에서 ±10%p 이상 벗어난 자산부문을 기준으로 균형 회복을 권유합니다.
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
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            {allocations.map((allocation) => (
              <div key={allocation.key} className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-slate-200">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: allocation.color }} />
                <span className="min-w-0 flex-1 leading-snug">{allocation.label}</span>
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-blue-900/70 bg-slate-950/70 p-2">
      <p className="mb-1 text-[9px] font-bold leading-snug text-slate-400">{label}</p>
      <p className="truncate text-[11px] font-black text-slate-100">{value}</p>
    </div>
  );
}

function normalizeIncludedAllocations(
  allocations: PortfolioAllocation[],
  excludedCandidates: string[],
): PortfolioAllocation[] {
  const activeAllocations = allocations
    .map((allocation) => ({
      ...allocation,
      candidates: allocation.candidates.filter((candidate) => !excludedCandidates.includes(candidate.name)),
    }))
    .filter((allocation) => allocation.candidates.length > 0);
  const totalWeight = activeAllocations.reduce((total, allocation) => total + allocation.weight, 0);

  if (totalWeight === 0) return [];

  const normalizedAllocations = activeAllocations.map((allocation) => {
    const exactWeight = (allocation.weight / totalWeight) * 100;
    return {
      allocation,
      weight: Math.floor(exactWeight),
      remainder: exactWeight - Math.floor(exactWeight),
    };
  });
  let remainingWeight = 100 - normalizedAllocations.reduce((total, item) => total + item.weight, 0);

  normalizedAllocations
    .map((item, index) => ({ index, remainder: item.remainder }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => {
      if (remainingWeight > 0) {
        normalizedAllocations[index].weight += 1;
        remainingWeight -= 1;
      }
    });

  return normalizedAllocations.map(({ allocation, weight }) => ({ ...allocation, weight }));
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
  if (import.meta.env.DEV) {
    return 0;
  }

  const storedValue = localStorage.getItem(REBALANCE_SUPPRESS_UNTIL_KEY);
  const suppressUntil = storedValue ? Number(storedValue) : 0;

  return Number.isFinite(suppressUntil) ? suppressUntil : 0;
}

function getGoalFeasibility(inputs: FinancialInputs): GoalFeasibility {
  const months = Math.max(1, inputs.goalYears * 12);
  const remainingManwon = Math.max(0, inputs.goalAmountManwon - inputs.currentAssetsManwon);
  const monthlyInvestableManwon = Math.max(0, inputs.monthlySalaryManwon - inputs.monthlySpendManwon);
  const requiredMonthlyInvestmentManwon = Math.ceil(remainingManwon / months);
  const coverageRatio =
    requiredMonthlyInvestmentManwon > 0 ? monthlyInvestableManwon / requiredMonthlyInvestmentManwon : Infinity;

  return {
    months,
    monthlyInvestableManwon,
    requiredMonthlyInvestmentManwon,
    coverageRatio,
    status: getFeasibilityStatus(coverageRatio, requiredMonthlyInvestmentManwon),
    statusLabel: getFeasibilityStatusLabel(coverageRatio, requiredMonthlyInvestmentManwon),
    horizonLabel: getHorizonLabel(inputs.goalYears),
  };
}

function getFeasibilityStatus(coverageRatio: number, requiredMonthlyInvestmentManwon: number): GoalFeasibilityStatus {
  if (requiredMonthlyInvestmentManwon === 0) return "achieved";
  if (coverageRatio >= 1.2) return "comfortable";
  if (coverageRatio >= 1) return "on-track";
  if (coverageRatio >= 0.6) return "tight";
  return "stretched";
}

function getFeasibilityStatusLabel(coverageRatio: number, requiredMonthlyInvestmentManwon: number) {
  if (requiredMonthlyInvestmentManwon === 0) return "이미 목표권";
  if (coverageRatio >= 1.2) return "여유";
  if (coverageRatio >= 1) return "적정";
  if (coverageRatio >= 0.6) return "빠듯";
  return "매우 부족";
}

function getHorizonLabel(goalYears: number) {
  if (goalYears <= 3) return "단기 목표";
  if (goalYears <= 7) return "중기 목표";
  return "장기 목표";
}

function getPortfolioDecisionExplanation(
  inputs: FinancialInputs,
  model: PortfolioModel,
  feasibility: GoalFeasibility,
) {
  const mainAllocation = model.allocations.reduce((selected, current) =>
    current.weight > selected.weight ? current : selected,
  );
  const riskLabel = getRiskProfileLabel(model.riskProfile);
  const needText =
    feasibility.requiredMonthlyInvestmentManwon === 0
      ? "현재 입력된 자산만으로 목표 금액에 도달한 상태입니다."
      : `목표를 ${feasibility.months}개월 안에 달성하려면 매달 최소 ${formatManwon(
          feasibility.requiredMonthlyInvestmentManwon,
        )}만원이 필요합니다. 현재 월 투자 여력은 ${formatManwon(
          feasibility.monthlyInvestableManwon,
        )}만원입니다.`;

  return {
    title: `${feasibility.statusLabel} 상태의 ${riskLabel} 포트폴리오`,
    summary: `${needText} 그래서 ${feasibility.horizonLabel}, 달성 여력, 투자성향을 함께 보고 ${mainAllocation.label}을 가장 큰 비중으로 둔 초안을 제시했습니다.`,
    reasons: [
      {
        title: "목표 달성 최소 월 투자금",
        body: getRequiredInvestmentReason(feasibility),
      },
      {
        title: "목표 기간",
        body: getHorizonReason(feasibility),
      },
      {
        title: "투자성향",
        body: `${riskLabel} 성향을 기본 출발점으로 사용했습니다. 다만 목표가 빠듯할수록 단순히 위험자산을 더 늘리는 방식보다 월 투자 여력 확대, 목표 금액 조정, 목표 기간 연장을 함께 검토하는 것이 더 현실적입니다.`,
      },
    ],
  };
}

function getRequiredInvestmentReason(feasibility: GoalFeasibility) {
  if (feasibility.status === "achieved") {
    return "현재 자산이 목표 금액 이상이므로 신규 투자보다 자산 보전과 목표 시점까지의 변동성 관리가 더 중요합니다.";
  }

  if (feasibility.status === "comfortable") {
    return `월 투자 여력이 목표 달성 최소 월 투자금의 ${formatCoverageRatio(
      feasibility.coverageRatio,
    )} 수준입니다. 목표 달성 여유가 있는 편이므로 무리하게 위험을 키우기보다 꾸준한 납입과 비중 관리가 중요합니다.`;
  }

  if (feasibility.status === "on-track") {
    return `월 투자 여력이 목표 달성 최소 월 투자금과 비슷한 수준입니다. 현재 납입 리듬을 유지하는지가 목표 달성 가능성에 큰 영향을 줍니다.`;
  }

  if (feasibility.status === "tight") {
    return `월 투자 여력이 목표 달성 최소 월 투자금의 ${formatCoverageRatio(
      feasibility.coverageRatio,
    )} 수준이라 다소 빠듯합니다. 투자수익률만으로 부족분을 해결하기보다 저축 여력 확대도 함께 검토해야 합니다.`;
  }

  return `월 투자 여력이 목표 달성 최소 월 투자금의 ${formatCoverageRatio(
    feasibility.coverageRatio,
  )} 수준입니다. 현재 조건에서는 목표 금액이나 기간을 조정하지 않으면 달성 가능성이 낮을 수 있습니다.`;
}

function getHorizonReason(feasibility: GoalFeasibility) {
  if (feasibility.horizonLabel === "단기 목표") {
    return "목표 기간이 짧은 편이라 큰 손실이 발생했을 때 회복할 시간이 제한적입니다. 그래서 성장 자산만으로 구성하기보다 예금/적금과 채권 비중도 함께 확인해야 합니다.";
  }

  if (feasibility.horizonLabel === "중기 목표") {
    return "목표 기간이 중간 정도라 성장성과 안정성을 함께 봐야 합니다. 투자성향에 따른 기본 비중을 유지하되 목표 달성 압박이 큰지 함께 판단합니다.";
  }

  return "목표 기간이 긴 편이라 단기 변동성을 견딜 시간이 상대적으로 있습니다. 월 투자 여력이 충분하다면 장기 성장 자산을 꾸준히 가져가는 전략을 검토할 수 있습니다.";
}

function getRiskProfileLabel(riskProfile: PortfolioModel["riskProfile"]) {
  if (riskProfile === "aggressive") return "공격형";
  if (riskProfile === "neutral") return "중립형";
  return "안정형";
}

function formatCoverageRatio(coverageRatio: number) {
  if (!Number.isFinite(coverageRatio)) return "충족";
  return `${Math.round(coverageRatio * 100)}%`;
}
