import {
  AlertTriangle,
  ChartPie,
  X,
  GraduationCap,
  Lightbulb,
  Network,
  Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getGoalLabel } from "../../constants/goals";
import { buildAssetPortfolioAllocations, countAssetPortfolioItems } from "../../lib/assetCalculations";
import { computeSimulationStats } from "../../lib/finance";
import { formatManwon, formatPercent } from "../../lib/format";
import type { AssetPortfolio, FinancialInputs, PortfolioModel } from "../../types/domain";
import { PortfolioChart } from "./PortfolioChart";

type PortfolioDashboardProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  assetPortfolio: AssetPortfolio;
  excludedCandidates: string[];
  onToggleCandidate: (candidateName: string) => void;
  onOpenAssetInput: () => void;
  onReset: () => void;
};

export function PortfolioDashboard({
  inputs,
  model,
  assetPortfolio,
  excludedCandidates,
  onToggleCandidate,
  onOpenAssetInput,
  onReset,
}: PortfolioDashboardProps) {
  const [showMptInfo, setShowMptInfo] = useState(false);
  const [showRecommendedChart, setShowRecommendedChart] = useState(false);
  const [candidateEditorOpen, setCandidateEditorOpen] = useState(false);
  const simulation = useMemo(() => computeSimulationStats(inputs, model), [inputs, model]);
  const assetAllocations = useMemo(() => buildAssetPortfolioAllocations(assetPortfolio), [assetPortfolio]);
  const assetCount = useMemo(() => countAssetPortfolioItems(assetPortfolio), [assetPortfolio]);
  const recommendedAllocations = useMemo(() => {
    const activeAllocations = model.allocations.filter((allocation) =>
      allocation.candidates.some((candidate) => !excludedCandidates.includes(candidate.name)),
    );
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
  }, [excludedCandidates, model.allocations]);
  const includedCandidateCount = model.allocations.reduce(
    (count, allocation) =>
      count + allocation.candidates.filter((candidate) => !excludedCandidates.includes(candidate.name)).length,
    0,
  );
  const hasPortfolioAssets = assetAllocations.length > 0;
  const displayedAllocations = hasPortfolioAssets && !showRecommendedChart ? assetAllocations : recommendedAllocations;
  const chartTitle =
    hasPortfolioAssets && !showRecommendedChart
      ? "실제 자산 기준 구성 비중"
      : "투자성향별 모델 포트폴리오 배분안";

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-50 px-5 py-5 pb-24">
      <Card className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">Goal-Based Investing</span>
          <button type="button" className="text-xs text-slate-400 underline hover:text-slate-600" onClick={onReset}>
            조건 변경
          </button>
        </div>
        <h2 className="mb-1 text-lg font-black">
          {inputs.goalYears}년 뒤 {getGoalLabel(inputs.goalType)}
        </h2>
        <div className="mb-2 mt-2.5 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700"
            style={{ width: `${simulation.progressPercent}%` }}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="font-extrabold text-blue-600">
              시뮬레이션 상 {simulation.monthSaved}개월 단축 기대 (미래 성과 비보장)
            </span>
            <span className="text-slate-500">
              현재 <strong className="text-slate-800">{simulation.progressPercent}%</strong> 달성
            </span>
          </div>
          <p className="text-[8px] leading-tight text-slate-400">
            * 과거 데이터 기반의 단순 산술 계산 결과로 원금 손실 가능성이 있으며, 미래 수익을 보장하지 않습니다.
          </p>
          <div className="text-right text-[11px] font-bold text-slate-700">
            ({formatManwon(inputs.currentAssetsManwon)}만 / {formatManwon(inputs.goalAmountManwon)}만원)
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
            <Network size={15} className="text-blue-600" />
            {chartTitle}
          </h3>
          <button
            type="button"
            className="rounded-lg bg-blue-50 px-2 py-1 text-[9px] font-extrabold text-blue-700 transition hover:bg-blue-100"
            onClick={() => setShowMptInfo((current) => !current)}
          >
            포트폴리오 추천 기준이 궁금하다면?
          </button>
        </div>

        <div className="relative mx-auto mb-3 h-40 w-40">
          <PortfolioChart allocations={displayedAllocations} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-bold uppercase text-slate-400">{hasPortfolioAssets && !showRecommendedChart ? "실제 입력 자산" : "기대수익률"}</span>
            <span className="text-lg font-black text-slate-800">
              {hasPortfolioAssets && !showRecommendedChart ? `${assetCount}개` : `연 ${formatPercent(model.expectedReturnPercent)}`}
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <Button className="w-full" variant="secondary" onClick={onOpenAssetInput}>
            <ChartPie size={15} />
            실제 자산 입력하기
          </Button>
          {hasPortfolioAssets ? (
            <Button className="w-full" variant="ghost" onClick={() => setShowRecommendedChart((current) => !current)}>
              {showRecommendedChart ? "실제 자산 기준 차트 보기" : "기존 추천 비중 보기"}
            </Button>
          ) : null}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1.5 text-[10px]">
          {displayedAllocations.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="flex-1 font-bold text-slate-600">{item.label}</span>
              <span className="font-black text-slate-900">{item.weight}%</span>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-[10px] font-extrabold text-slate-900">
              <Network size={12} />
              부문별 적합 금융상품 후보군
            </h4>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-extrabold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
              onClick={() => setCandidateEditorOpen(true)}
            >
              <Settings2 size={11} />
              편집
            </button>
          </div>
          {includedCandidateCount > 0 ? (
            <div className="space-y-3">
              {model.allocations.map((allocation) => {
                const includedCandidates = allocation.candidates.filter(
                  (candidate) => !excludedCandidates.includes(candidate.name),
                );

                if (includedCandidates.length === 0) return null;

                return (
                  <div key={allocation.key}>
                    <p className="mb-1 text-[10px] font-black text-slate-700">{allocation.label}</p>
                    <div className="space-y-1.5">
                      {includedCandidates.map((candidate) => (
                        <div key={candidate.name} className="rounded-lg bg-white p-2 text-[10px] text-slate-500">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-slate-800">{candidate.name}</strong>
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700">{candidate.category}</span>
                          </div>
                          <p className="mt-1 leading-relaxed">{candidate.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-extrabold">모든 추천 종목이 제외되었습니다.</p>
                <p className="mt-0.5 text-[9px] leading-relaxed text-amber-700">편집에서 후보 종목을 다시 추가해 주세요.</p>
              </div>
            </div>
          )}
        </div>

      </Card>

      {candidateEditorOpen ? (
        <div className="absolute inset-0 z-[60] flex flex-col bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 pb-4 pt-9">
            <div>
              <p className="mb-0.5 text-[10px] font-bold text-blue-600">추천 포트폴리오</p>
              <h3 className="text-lg font-black text-slate-900">포트폴리오 종목 편집</h3>
            </div>
            <button
              type="button"
              aria-label="포트폴리오 종목 편집 닫기"
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setCandidateEditorOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 pb-8">
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
              <Settings2 size={15} className="mt-0.5 shrink-0 text-blue-600" />
              <p className="text-[10px] leading-relaxed text-blue-800">
                추천 후보를 직접 추가하거나 제외할 수 있습니다.
              </p>
            </div>

            <div className="space-y-5">
              {model.allocations.map((allocation) => {
                const includedCount = allocation.candidates.filter(
                  (candidate) => !excludedCandidates.includes(candidate.name),
                ).length;

                return (
                  <section key={allocation.key}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocation.color }} />
                        <h4 className="text-xs font-extrabold text-slate-800">{allocation.label}</h4>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">
                        {includedCount}/{allocation.candidates.length} 추가
                      </span>
                    </div>

                    <div className="space-y-2">
                      {allocation.candidates.map((candidate) => {
                        const excluded = excludedCandidates.includes(candidate.name);

                        return (
                          <div key={candidate.name} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                  <strong className="text-xs text-slate-900">{candidate.name}</strong>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-600">
                                    {candidate.category}
                                  </span>
                                </div>
                                <p className="text-[9px] leading-relaxed text-slate-500">{candidate.reason}</p>
                              </div>
                              <button
                                type="button"
                                aria-pressed={!excluded}
                                className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-extrabold transition ${
                                  excluded
                                    ? "border border-slate-200 bg-slate-100 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
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
      ) : null}

      {showMptInfo ? (
        <div className="absolute inset-0 z-40 bg-slate-900/20 px-5 pt-28 backdrop-blur-[1px]" onClick={() => setShowMptInfo(false)}>
          <div
            className="no-scrollbar max-h-[70vh] overflow-y-auto rounded-2xl border border-blue-100 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h4 className="flex items-center gap-1 text-sm font-extrabold text-blue-900">
                <Lightbulb size={16} />
                왜 MPT 기반 배분인가요?
              </h4>
              <button
                type="button"
                aria-label="추천 기준 닫기"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setShowMptInfo(false)}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-700">
              상관관계가 낮은 자산을 섞어 목표 수익률 대비 변동성을 낮추는 방식입니다. 현재는 목데이터 기반이며, 이후 실제 상품/가격 데이터와 연결합니다.
            </p>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <h4 className="mb-1.5 flex items-center gap-1 text-xs font-extrabold text-blue-900">
                <GraduationCap size={14} />
                AI 포트폴리오 추천 엔진 브리핑
              </h4>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-700">{model.xaiSummary}</p>
              <ul className="space-y-1 rounded-lg border border-blue-200 bg-white p-2.5 text-[9px] text-slate-500">
                {model.rationaleFactors.map((factor) => (
                  <li key={factor}>- {factor}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}
