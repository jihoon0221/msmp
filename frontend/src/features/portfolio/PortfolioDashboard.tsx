import {
  ChartPie,
  X,
  GraduationCap,
  Lightbulb,
  Network,
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
  onOpenAssetInput: () => void;
  onReset: () => void;
};

export function PortfolioDashboard({ inputs, model, assetPortfolio, onOpenAssetInput, onReset }: PortfolioDashboardProps) {
  const [showMptInfo, setShowMptInfo] = useState(false);
  const [showRecommendedChart, setShowRecommendedChart] = useState(false);
  const simulation = useMemo(() => computeSimulationStats(inputs, model), [inputs, model]);
  const assetAllocations = useMemo(() => buildAssetPortfolioAllocations(assetPortfolio), [assetPortfolio]);
  const assetCount = useMemo(() => countAssetPortfolioItems(assetPortfolio), [assetPortfolio]);
  const hasPortfolioAssets = assetAllocations.length > 0;
  const displayedAllocations = hasPortfolioAssets && !showRecommendedChart ? assetAllocations : model.allocations;
  const chartTitle =
    hasPortfolioAssets && !showRecommendedChart
      ? "실제 자산 기준 구성 비중"
      : "투자성향별 모델 포트폴리오 배분안";

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
            {chartTitle}
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
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">자산부문 비중</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="h-48 w-48">
              <PortfolioChart allocations={displayedAllocations} />
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2">
              {displayedAllocations.map((allocation) => (
                <div key={allocation.key} className="flex items-center gap-3 rounded-3xl border border-slate-700 bg-slate-900 p-3">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: allocation.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">{allocation.label}</p>
                    <p className="text-[11px] text-slate-400">{allocation.weight}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3">
          <Button className="w-full" variant="secondary" onClick={onOpenAssetInput}>
            <ChartPie size={15} />
            실제 자산 입력하기
          </Button>
          {hasPortfolioAssets ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="w-full px-2"
                variant={!showRecommendedChart ? "secondary" : "ghost"}
                onClick={() => setShowRecommendedChart(false)}
              >
                실제자산 기준 차트보기
              </Button>
              <Button
                className="w-full px-2"
                variant={showRecommendedChart ? "secondary" : "ghost"}
                onClick={() => setShowRecommendedChart(true)}
              >
                기존 추천비중보기
              </Button>
            </div>
          ) : null}
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

    </main>
  );
}
