import {
  Bolt,
  ChartPie,
  X,
  GraduationCap,
  Lightbulb,
  Network,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getGoalLabel } from "../../constants/goals";
import { buildActualAllocations, computeSimulationStats } from "../../lib/finance";
import { formatManwon, formatPercent } from "../../lib/format";
import type { ActualAsset, FinancialInputs, PortfolioModel } from "../../types/domain";
import { PortfolioChart } from "./PortfolioChart";

type PortfolioDashboardProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  actualAssets: ActualAsset[];
  onOpenAssetInput: () => void;
  onReset: () => void;
};

export function PortfolioDashboard({ inputs, model, actualAssets, onOpenAssetInput, onReset }: PortfolioDashboardProps) {
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [showMptInfo, setShowMptInfo] = useState(false);
  const [showRecommendedChart, setShowRecommendedChart] = useState(false);
  const simulation = useMemo(() => computeSimulationStats(inputs, model), [inputs, model]);
  const actualAllocations = useMemo(() => buildActualAllocations(actualAssets), [actualAssets]);
  const hasActualAssets = actualAllocations.length > 0;
  const displayedAllocations = hasActualAssets && !showRecommendedChart ? actualAllocations : model.allocations;
  const chartTitle =
    hasActualAssets && !showRecommendedChart
      ? "실제 자산 기준 구성 비중"
      : "투자성향별 모델 포트폴리오 배분안";

  const showRebalancePrompt = () => {
    setRebalanceOpen(true);
  };

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-50 px-5 py-5 pb-24">
      <div className="mb-4">
        <Button className="w-full px-2" variant="secondary" onClick={showRebalancePrompt}>
          <RotateCcw size={15} />
          현재 상태 점검 및 리밸런싱
        </Button>
      </div>

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
            <span className="text-[9px] font-bold uppercase text-slate-400">{hasActualAssets && !showRecommendedChart ? "실제 입력 자산" : "기대수익률"}</span>
            <span className="text-lg font-black text-slate-800">
              {hasActualAssets && !showRecommendedChart ? `${actualAssets.length}개` : `연 ${formatPercent(model.expectedReturnPercent)}`}
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <Button className="w-full" variant="secondary" onClick={onOpenAssetInput}>
            <ChartPie size={15} />
            실제 자산 입력하기
          </Button>
          {hasActualAssets ? (
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
            <span className="rounded bg-slate-200 px-1 py-0.5 text-[8px] font-black text-slate-700">공시 준비</span>
          </div>
          <div className="space-y-3">
            {model.allocations.map((allocation) => (
              <div key={allocation.key}>
                <p className="mb-1 text-[10px] font-black text-slate-700">{allocation.label}</p>
                <div className="space-y-1.5">
                  {allocation.candidates.map((candidate) => (
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
            ))}
          </div>
        </div>

      </Card>

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

      {rebalanceOpen ? (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="rounded-t-3xl bg-white p-6 pb-12">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-300" />
            <h3 className="mb-1 text-xl font-black text-slate-900">포트폴리오 리밸런싱</h3>
            <p className="mb-4 text-xs text-slate-500">
              현재 비중이 목표 비중에서 이탈했다고 가정하고 기존/복구 비중을 비교합니다.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <RebalanceBar title="기존 비중" stock={Math.min(90, model.allocations[0].weight + 18)} safe={Math.max(10, 100 - model.allocations[0].weight - 18)} muted />
              <RebalanceBar title="리밸런싱 후" stock={model.allocations[0].weight} safe={100 - model.allocations[0].weight} />
            </div>
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-1.5 text-xs font-bold text-blue-800">AI 리밸런싱 전략 가이드</p>
              <p className="text-[11px] leading-relaxed text-blue-700">
                성장 자산의 초과 비중을 일부 줄이고 안전 자산으로 이동해 목표 달성 확률을 안정화합니다.
              </p>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" variant="ghost" onClick={() => setRebalanceOpen(false)}>
                나중에
              </Button>
              <Button className="flex-[2]" variant="secondary" onClick={() => setRebalanceOpen(false)}>
                <Bolt size={15} />
                원클릭 실행
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

type RebalanceBarProps = {
  title: string;
  stock: number;
  safe: number;
  muted?: boolean;
};

function RebalanceBar({ title, stock, safe, muted = false }: RebalanceBarProps) {
  return (
    <div className={muted ? "border-r border-slate-200 pr-2" : "pl-2"}>
      <span className={`mb-2 block text-center text-[10px] font-extrabold uppercase ${muted ? "text-slate-400" : "text-blue-600"}`}>
        {title}
      </span>
      <div className="space-y-2 text-[10px]">
        <div>
          <div className="mb-0.5 flex justify-between font-bold">
            <span>주식 자산</span>
            <span className={muted ? "text-red-500" : "text-blue-600"}>{stock}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full ${muted ? "bg-red-400" : "bg-blue-500"}`} style={{ width: `${stock}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-0.5 flex justify-between font-bold">
            <span>안전 자산</span>
            <span className={muted ? "text-slate-500" : "text-green-600"}>{safe}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full ${muted ? "bg-slate-400" : "bg-green-500"}`} style={{ width: `${safe}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
