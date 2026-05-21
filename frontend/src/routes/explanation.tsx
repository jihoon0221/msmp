import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PhoneShell, PageHeader } from "@/components/PhoneShell";
import { CheckCircle2, Sparkles } from "lucide-react";
import { loadGoals, subscribeGoals } from "@/lib/goalsStore";
import { buildPortfolio, reasonsFor, type PortfolioPlan } from "@/lib/portfolio";

export const Route = createFileRoute("/explanation")({
  head: () => ({
    meta: [
      { title: "AI 추천 설명 — 머니파일럿" },
      { name: "description", content: "AI가 이 포트폴리오를 추천한 이유를 명확하게 설명해드려요." },
    ],
  }),
  component: Explanation,
});

function Explanation() {
  const [plan, setPlan] = useState<PortfolioPlan>(() => buildPortfolio(loadGoals()));

  useEffect(() => {
    return subscribeGoals(() => setPlan(buildPortfolio(loadGoals())));
  }, []);

  const reasons = reasonsFor(plan);
  const goal = plan.goal;

  return (
    <PhoneShell>
      <PageHeader
        title="AI는 이렇게 판단했어요"
        subtitle="결정의 근거를 모두 공개합니다"
        back="/recommendation"
      />

      <div className="px-5">
        <div className="bg-gradient-to-br from-primary to-[oklch(0.55_0.22_265)] text-primary-foreground rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
            <Sparkles size={14} /> AI 분석 요약
          </div>
          <p className="text-[15px] leading-relaxed mt-2.5 font-medium">
            {goal ? (
              <>
                "<span className="font-bold">{goal.title}</span>" 목표 ({goal.months}개월 ·{" "}
                {goal.target.toLocaleString()}만원)에 맞춰
                <span className="font-bold"> {plan.profileLabel}</span> 포트폴리오를 추천드려요.
              </>
            ) : (
              <>
                설정된 목표에 맞춰 <span className="font-bold">{plan.profileLabel}</span>{" "}
                포트폴리오를 추천드려요.
              </>
            )}
          </p>
        </div>

        <h2 className="text-base font-semibold mt-6 mb-3 px-1">추천 근거 {reasons.length}가지</h2>
        <div className="space-y-2.5">
          {reasons.map((r, i) => (
            <div key={i} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">{r.title}</p>
                  <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
                    {r.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-secondary/50 rounded-2xl p-4 mt-4">
          <p className="text-xs font-semibold mb-2">📊 사용된 데이터</p>
          <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
            <li>• 입력한 재무 정보 (수입·지출·자산·부채)</li>
            <li>• 설정한 재무 목표 · 우선순위 · 기간</li>
            <li>• 자산군별 장기 수익률·변동성 통계</li>
            <li>• 목표 기간({goal?.months ?? "-"}개월) 기반 위험 허용도 자동 분류</li>
          </ul>
        </div>

        <Link
          to="/dashboard"
          className="block w-full text-center bg-primary text-primary-foreground font-semibold py-4 rounded-2xl mt-5 active:scale-[0.98] transition-transform"
        >
          이해했어요, 시작할게요
        </Link>
      </div>
    </PhoneShell>
  );
}
