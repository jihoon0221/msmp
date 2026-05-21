import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PhoneShell, PageHeader } from "@/components/PhoneShell";
import { Info, Sparkles, TrendingUp, Target } from "lucide-react";
import { loadGoals, subscribeGoals } from "@/lib/goalsStore";
import { buildPortfolio, type PortfolioPlan, type AllocationItem } from "@/lib/portfolio";

export const Route = createFileRoute("/recommendation")({
  head: () => ({
    meta: [
      { title: "AI 포트폴리오 추천 — 머니파일럿" },
      { name: "description", content: "선택한 목표에 맞춰 자산배분과 종목을 제안해드려요." },
    ],
  }),
  component: Recommendation,
});

function Recommendation() {
  const [plan, setPlan] = useState<PortfolioPlan>(() => buildPortfolio(loadGoals()));

  useEffect(() => {
    return subscribeGoals(() => setPlan(buildPortfolio(loadGoals())));
  }, []);

  const monthly = plan.monthlyKRWMan;
  const goal = plan.goal;

  return (
    <PhoneShell>
      <PageHeader title="AI 추천 포트폴리오" subtitle="선택한 목표에 맞춰 자동 구성됐어요" />

      <div className="px-5">
        {goal && (
          <div className="bg-primary-soft border border-primary/20 rounded-2xl p-4 mb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-xl">
              {goal.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Target size={12} className="text-primary" />
                <p className="text-[11px] text-primary font-semibold">기준 목표</p>
              </div>
              <p className="font-semibold text-sm truncate">{goal.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {goal.months}개월 · {goal.target.toLocaleString()}만원 · 우선순위 {goal.priority}
              </p>
            </div>
          </div>
        )}

        <div className="bg-surface border border-border rounded-3xl p-6">
          <div className="flex items-center gap-2 text-xs text-primary font-semibold">
            <Sparkles size={14} /> {plan.profileLabel}
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            매월 <span className="font-bold text-foreground">{monthly.toLocaleString()}만원</span>을
            아래 비율로 자동 분산하는 걸 추천드려요.
          </p>

          <DonutChart
            allocation={plan.allocation}
            expectedReturn={plan.expectedReturn}
            riskLabel={plan.riskLabel}
          />

          <div className="space-y-2.5 mt-5">
            {plan.allocation.map((a) => (
              <div key={a.name} className="flex items-center gap-3">
                <span className="w-3 h-3 shrink-0 rounded-full" style={{ background: a.color }} />
                <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold">{a.name}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">{a.desc}</span>
                  </div>
                  <span className="shrink-0 font-bold text-sm">{a.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
            <TrendingUp size={16} className="text-primary" />
            <h3 className="font-bold text-sm">추천 종목</h3>
            <span className="text-[11px] text-muted-foreground">목표에 맞춘 구체 종목이에요</span>
          </div>

          <div className="space-y-3">
            {plan.allocation.map((a) => {
              const items = plan.holdings[a.name] ?? [];
              if (items.length === 0) return null;
              const categoryAmount = Math.round((a.pct / 100) * monthly);
              return (
                <div key={a.name} className="bg-surface border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 shrink-0 rounded-full"
                        style={{ background: a.color }}
                      />
                      <span className="text-sm font-bold">{a.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {a.pct}% · 월 {categoryAmount}만원
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {items.map((h) => {
                      const amount = Math.round((h.weight / 100) * categoryAmount);
                      return (
                        <div
                          key={h.ticker}
                          className="flex items-start justify-between gap-3 py-1.5 border-t border-border/60 first:border-t-0 first:pt-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold truncate">{h.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                {h.ticker}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight break-words">
                              {h.reason}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold">{h.weight}%</div>
                            <div className="text-[10px] text-muted-foreground">월 {amount}만원</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Link
          to="/explanation"
          className="flex items-center justify-between gap-3 bg-primary-soft border border-primary/20 rounded-2xl p-4 mt-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Info size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-sm">왜 이렇게 추천했나요?</p>
              <p className="text-xs text-muted-foreground">AI의 판단 근거를 확인하세요</p>
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap text-primary font-semibold text-sm">
            자세히 →
          </span>
        </Link>

        <div className="mt-3 bg-surface border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">
            ⚠️ 본 추천은 투자 권유가 아닌 참고용 자료예요. 최종 결정은 직접 판단해주세요.
          </p>
        </div>
      </div>
    </PhoneShell>
  );
}

function DonutChart({
  allocation,
  expectedReturn,
  riskLabel,
}: {
  allocation: AllocationItem[];
  expectedReturn: number;
  riskLabel: string;
}) {
  const size = 180;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;

  let acc = 0;
  return (
    <div className="flex justify-center my-5">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-secondary)"
            strokeWidth={stroke}
            fill="none"
          />
          {allocation.map((a) => {
            const len = (a.pct / 100) * circ;
            const offset = circ - acc;
            acc += len;
            return (
              <circle
                key={a.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={a.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">예상 연수익</span>
          <span className="text-2xl font-bold mt-0.5">{expectedReturn}%</span>
          <span className="text-[10px] text-muted-foreground mt-0.5 text-center px-2 leading-tight">
            {riskLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
