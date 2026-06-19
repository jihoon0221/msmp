import { BarChart3, ChartNoAxesColumn, Scale, Target, Wallet } from "lucide-react";
import { useMemo } from "react";
import { goalOptions } from "../../constants/goals";
import { countAssetPortfolioItems, summarizeAssetPortfolioByCurrency } from "../../lib/assetCalculations";
import { getMonthlyInvestable } from "../../lib/finance";
import { formatManwon, formatWon } from "../../lib/format";
import type { AssetPortfolio, FinancialInputs, RiskProfile } from "../../types/domain";
import { Button } from "../../components/ui/Button";

type OnboardingFormProps = {
  inputs: FinancialInputs;
  assetPortfolio: AssetPortfolio;
  error: string | null;
  onChange: (inputs: FinancialInputs) => void;
  onOpenAssetsView: () => void;
  onAnalyze: () => void | Promise<void>;
};

const riskOptions: Array<{ value: RiskProfile; label: string }> = [
  { value: "aggressive", label: "공격형" },
  { value: "neutral", label: "중립형" },
  { value: "stable", label: "안정형" },
];

export function OnboardingForm({
  inputs,
  assetPortfolio,
  error,
  onChange,
  onOpenAssetsView,
  onAnalyze,
}: OnboardingFormProps) {
  const monthlyInvestable = getMonthlyInvestable(inputs);
  const assetSummaries = useMemo(() => summarizeAssetPortfolioByCurrency(assetPortfolio), [assetPortfolio]);
  const assetCount = useMemo(() => countAssetPortfolioItems(assetPortfolio), [assetPortfolio]);
  const totalAssetValue = useMemo(
    () => assetSummaries.reduce((total, summary) => total + summary.totalValue, 0),
    [assetSummaries],
  );

  const update = <Key extends keyof FinancialInputs>(key: Key, value: FinancialInputs[Key]) => {
    onChange({ ...inputs, [key]: value });
  };

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-950 px-5 py-5 pb-24">
      <div className="mb-5">
        <h2 className="mb-1.5 text-2xl font-black leading-tight text-slate-100">
          사회초년생을 위한
          <br />
          <span className="gradient-text">첫 목적기반 자산 관리</span>
        </h2>
        <p className="text-xs leading-relaxed text-slate-400">
          마이데이터 기반 현금흐름과 투자성향을 입력하면 목표 달성 가능성을 기준으로 포트폴리오 초안을 계산합니다.
        </p>
      </div>

      <section className="glass-card mb-5 rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
          <Target size={16} className="text-blue-400" />
          나의 재무 목표
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">어떤 목돈을 모으고 싶으신가요?</span>
            <select
              value={inputs.goalType}
              onChange={(event) => update("goalType", event.target.value as FinancialInputs["goalType"])}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {goalOptions.map((goal) => (
                <option key={goal.value} value={goal.value}>
                  {goal.label}
                </option>
              ))}
            </select>
          </label>

          {inputs.goalType === "other" ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">기타 목표 입력</span>
              <input
                type="text"
                value={inputs.customGoalLabel ?? ""}
                onChange={(event) => update("customGoalLabel", event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 창업자금, 유학비 등"
              />
            </label>
          ) : null}

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">목표액 (만원)</span>
              <input
                type="number"
                min={0}
                value={inputs.goalAmountManwon}
                onChange={(event) => update("goalAmountManwon", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">희망 기한 (년)</span>
              <input
                type="number"
                min={1}
                value={inputs.goalYears}
                onChange={(event) => update("goalYears", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="glass-card mb-5 rounded-2xl p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Wallet size={16} className="text-emerald-400" />
            현재 자산 현황
          </h3>
        </div>
        <p className="mb-3 text-[10px] text-slate-400">자산현황에 입력한 보유자산과 현금흐름을 기준으로 추천 요청을 생성합니다.</p>
        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-left transition hover:border-blue-500 hover:bg-slate-900"
            onClick={onOpenAssetsView}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-blue-300">
                <ChartNoAxesColumn size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold text-slate-400">자산 보유 현황 입력</span>
                <span className="block truncate text-sm font-black text-slate-100">
                  {assetCount > 0 ? formatWon(totalAssetValue) : "입력된 자산이 없습니다"}
                </span>
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-extrabold text-white">입력</span>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">월 실수령액 (만원)</span>
              <input
                type="number"
                min={0}
                value={inputs.monthlySalaryManwon}
                onChange={(event) => update("monthlySalaryManwon", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">월 소비 (만원)</span>
              <input
                type="number"
                min={0}
                value={inputs.monthlySpendManwon}
                onChange={(event) => update("monthlySpendManwon", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-800 p-2.5 text-xs">
            <span className="font-bold text-slate-100">월 운용 가능 금액</span>
            <span className="text-sm font-black text-blue-300">{formatManwon(monthlyInvestable)} 만원</span>
          </div>
        </div>
      </section>

      <section className="glass-card mb-6 rounded-2xl p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-100">
          <Scale size={16} className="text-indigo-400" />
          투자 성향 자가 진단
        </h3>
        <p className="mb-3 text-[10px] text-slate-400">투자성향은 추천 API 요청의 핵심 조건으로 사용됩니다.</p>
        <div className="grid grid-cols-3 gap-2">
          {riskOptions.map((risk) => {
            const selected = inputs.riskProfile === risk.value;
            return (
              <button
                key={risk.value}
                type="button"
                className={`rounded-xl py-2 text-xs font-bold transition ${
                  selected
                    ? "scale-[1.02] border-2 border-blue-500 bg-slate-800 text-slate-100 shadow-sm"
                    : "border border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
                onClick={() => update("riskProfile", risk.value)}
              >
                {risk.label}
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <p className="mb-3 rounded-xl border border-rose-800 bg-rose-950 p-3 text-xs font-semibold text-rose-300">
          {error}
        </p>
      ) : null}

      <Button className="w-full text-base" onClick={onAnalyze}>
        포트폴리오 추천받기
        <BarChart3 size={18} />
      </Button>
    </main>
  );
}
