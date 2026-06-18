import { BarChart3, Scale, Target, Wallet } from "lucide-react";
import { goalOptions } from "../../constants/goals";
import { getMonthlyInvestable } from "../../lib/finance";
import { formatManwon } from "../../lib/format";
import type { FinancialInputs, RiskProfile } from "../../types/domain";
import { Button } from "../../components/ui/Button";

type OnboardingFormProps = {
  inputs: FinancialInputs;
  error: string | null;
  onChange: (inputs: FinancialInputs) => void;
  onAnalyze: () => void | Promise<void>;
};

const riskOptions: Array<{ value: RiskProfile; label: string }> = [
  { value: "aggressive", label: "공격형" },
  { value: "neutral", label: "중립형" },
  { value: "stable", label: "안정형" },
];

export function OnboardingForm({ inputs, error, onChange, onAnalyze }: OnboardingFormProps) {
  const monthlyInvestable = getMonthlyInvestable(inputs);

  const update = <Key extends keyof FinancialInputs>(key: Key, value: FinancialInputs[Key]) => {
    onChange({ ...inputs, [key]: value });
  };

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 pb-24">
      <div className="mb-5">
        <h2 className="mb-1.5 text-2xl font-black leading-tight">
          사회초년생을 위한
          <br />
          <span className="gradient-text">첫 목적기반 자산 관리</span>
        </h2>
        <p className="text-xs leading-relaxed text-slate-500">
          마이데이터 기반 현금흐름과 투자성향을 입력하면 목표 달성 가능성을 기준으로 포트폴리오 초안을 계산합니다.
        </p>
      </div>

      <section className="glass-card mb-5 rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Target size={16} className="text-blue-600" />
          가장 중요한 재무 목표
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">어떤 목돈을 모으고 싶으신가요?</span>
            <select
              value={inputs.goalType}
              onChange={(event) => update("goalType", event.target.value as FinancialInputs["goalType"])}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">기타 목표 입력</span>
              <input
                type="text"
                value={inputs.customGoalLabel ?? ""}
                onChange={(event) => update("customGoalLabel", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 창업자금, 유학비 등"
              />
            </label>
          ) : null}

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">목표액 (만원)</span>
              <input
                type="number"
                min={0}
                value={inputs.goalAmountManwon}
                onChange={(event) => update("goalAmountManwon", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">희망 기한 (년)</span>
              <input
                type="number"
                min={1}
                value={inputs.goalYears}
                onChange={(event) => update("goalYears", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="glass-card mb-5 rounded-2xl p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Wallet size={16} className="text-emerald-600" />
            현재 자산 현황
          </h3>
        </div>
        <p className="mb-3 text-[10px] text-slate-400">입력한 현금흐름을 기준으로 포트폴리오 추천 요청을 생성합니다.</p>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">현재 보유 자금 (만원)</span>
            <input
              type="number"
              min={0}
              value={inputs.currentAssetsManwon}
              onChange={(event) => update("currentAssetsManwon", Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">월 실수령액 (만원)</span>
              <input
                type="number"
                min={0}
                value={inputs.monthlySalaryManwon}
                onChange={(event) => update("monthlySalaryManwon", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">월 소비 (만원)</span>
              <input
                type="number"
                min={0}
                value={inputs.monthlySpendManwon}
                onChange={(event) => update("monthlySpendManwon", Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-blue-50 p-2.5 text-xs">
            <span className="font-bold text-blue-800">월 운용 가능 금액</span>
            <span className="text-sm font-black text-blue-900">{formatManwon(monthlyInvestable)} 만원</span>
          </div>
        </div>
      </section>

      <section className="glass-card mb-6 rounded-2xl p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Scale size={16} className="text-indigo-600" />
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
                    ? "scale-[1.02] border-2 border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                    : "border border-slate-200 text-slate-500 hover:bg-slate-50"
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
        <p className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <Button className="w-full text-base" onClick={onAnalyze}>
        시나리오 연산 & AI 자산배분
        <BarChart3 size={18} />
      </Button>
    </main>
  );
}
