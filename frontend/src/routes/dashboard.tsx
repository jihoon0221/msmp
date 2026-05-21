import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";
import { ArrowRight, TrendingUp, Heart, Wallet, Sparkles } from "lucide-react";

type Search = { income?: string; expense?: string; assets?: string; debt?: string };

const clampMoney = (value: string | undefined, fallback: number) => {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(9999999, Math.max(0, Math.round(number)));
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "재무 대시보드 — 머니파일럿" },
      { name: "description", content: "순자산, 월 투자가능액, 재무건강 점수를 한눈에." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    income: typeof s.income === "string" ? s.income : undefined,
    expense: typeof s.expense === "string" ? s.expense : undefined,
    assets: typeof s.assets === "string" ? s.assets : undefined,
    debt: typeof s.debt === "string" ? s.debt : undefined,
  }),
  component: Dashboard,
});

function Dashboard() {
  const { income, expense, assets, debt } = Route.useSearch();
  const inc = clampMoney(income, 320);
  const exp = clampMoney(expense, 180);
  const ast = clampMoney(assets, 1500);
  const dbt = clampMoney(debt, 300);

  const net = ast - dbt;
  const investable = Math.max(0, Math.round((inc - exp) * 0.7));
  // simple health score
  const savingRate = inc > 0 ? (inc - exp) / inc : 0;
  const debtRatio = ast > 0 ? dbt / ast : 1;
  const score = Math.max(20, Math.min(99, Math.round(50 + savingRate * 60 - debtRatio * 30)));
  const grade =
    score >= 80
      ? "매우 건강해요"
      : score >= 65
        ? "양호해요"
        : score >= 50
          ? "보통이에요"
          : "관리가 필요해요";
  const grade_color =
    score >= 80 ? "text-success" : score >= 50 ? "text-primary" : "text-destructive";

  return (
    <PhoneShell>
      <header className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles size={16} className="shrink-0 text-primary" />
            <span className="text-sm font-bold tracking-tight">머니 파일럿</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">안녕하세요, 동민님 👋</p>
        <h1 className="text-2xl font-bold mt-1">오늘도 한 걸음 더 가까워졌어요</h1>
      </header>

      {/* Net worth hero */}
      <section className="mx-5 mt-5 bg-gradient-to-br from-primary to-[oklch(0.55_0.22_265)] text-primary-foreground rounded-3xl p-6 shadow-lg shadow-primary/20">
        <p className="text-sm opacity-90">내 순자산</p>
        <p className="text-[32px] font-bold mt-1 tracking-tight break-words">
          {net.toLocaleString()}
          <span className="text-lg font-semibold ml-1 opacity-90">만원</span>
        </p>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <MiniStat label="총 자산" value={`${ast.toLocaleString()}만`} />
          <MiniStat label="총 부채" value={`${dbt.toLocaleString()}만`} />
        </div>
      </section>

      {/* Health score */}
      <section className="mx-5 mt-3 bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-primary" />
            <h2 className="font-semibold">재무 건강 점수</h2>
          </div>
          <span className={`text-xs font-semibold ${grade_color}`}>{grade}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-4xl font-bold">{score}</span>
          <span className="text-muted-foreground text-sm">/ 100</span>
        </div>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-[oklch(0.7_0.18_200)] rounded-full transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          저축률 {Math.round(savingRate * 100)}%, 부채비율 {Math.round(debtRatio * 100)}%를 기준으로
          계산했어요.
        </p>
      </section>

      {/* Quick stats */}
      <section className="mx-5 mt-3 grid grid-cols-2 gap-3">
        <Card
          icon={<Wallet size={18} className="text-primary" />}
          label="월 투자 가능액"
          value={`${investable}만원`}
        />
        <Card
          icon={<TrendingUp size={18} className="text-success" />}
          label="저축 가능액"
          value={`${inc - exp}만원`}
        />
      </section>

      {/* CTAs */}
      <section className="mx-5 mt-4 space-y-3">
        <Link
          to="/goals"
          className="flex items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-5 active:bg-secondary"
        >
          <div className="min-w-0">
            <p className="text-xs text-primary font-semibold">🎯 다음 단계</p>
            <p className="truncate font-semibold mt-1">재무 목표 설정하기</p>
            <p className="text-xs text-muted-foreground mt-0.5">목표를 정하면 더 정확해져요</p>
          </div>
          <ArrowRight size={20} className="shrink-0 text-muted-foreground" />
        </Link>
        <Link
          to="/recommendation"
          className="flex items-center justify-between gap-3 bg-primary-soft border border-primary/20 rounded-2xl p-5"
        >
          <div className="min-w-0">
            <p className="text-xs text-primary font-semibold">✨ AI 추천</p>
            <p className="truncate font-semibold mt-1">나만의 포트폴리오 받기</p>
            <p className="text-xs text-muted-foreground mt-0.5">AI가 분석한 자산 배분</p>
          </div>
          <ArrowRight size={20} className="shrink-0 text-primary" />
        </Link>
      </section>
    </PhoneShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl px-3 py-2.5">
      <p className="text-[11px] opacity-80">{label}</p>
      <p className="truncate font-bold mt-0.5">{value}</p>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="min-w-0 truncate text-xs text-muted-foreground font-medium">{label}</p>
      </div>
      <p className="truncate text-lg font-bold mt-2">{value}</p>
    </div>
  );
}
