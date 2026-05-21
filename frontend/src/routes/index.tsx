import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";
import { Sparkles, ShieldCheck, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "머니파일럿 — 나만의 AI 자산관리" },
      {
        name: "description",
        content:
          "사회초년생을 위한 목표 기반 AI 자산관리 서비스. 진단부터 추천까지, 쉽고 명확하게.",
      },
      { property: "og:title", content: "머니파일럿 — 나만의 AI 자산관리" },
      {
        property: "og:description",
        content: "사회초년생을 위한 목표 기반 AI 자산관리 서비스.",
      },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  return (
    <PhoneShell showTabs={false}>
      <div className="flex-1 flex flex-col px-6 pt-16">
        <div className="inline-flex items-center gap-2 self-start bg-primary-soft text-primary px-3 py-1.5 rounded-full text-xs font-semibold">
          <Sparkles size={14} />
          AI Private Banker
        </div>

        <p className="mt-6 text-[15px] font-semibold text-primary tracking-tight">머니 파일럿</p>
        <h1 className="text-[34px] leading-tight font-bold mt-1">
          돈 모으는 일,
          <br />
          이제 어렵지 않게.
        </h1>
        <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
          내 상황에 딱 맞는 자산관리를
          <br />
          AI가 쉽게 설명해드려요.
        </p>

        <div className="mt-10 space-y-3">
          <FeatureRow
            icon={<ShieldCheck className="text-primary" size={22} />}
            title="통합 자산 진단"
            desc="수입·지출·자산을 한눈에"
          />
          <FeatureRow
            icon={<TrendingUp className="text-success" size={22} />}
            title="목표 기반 플랜"
            desc="내 목표에 맞춘 저축 계획"
          />
          <FeatureRow
            icon={<Sparkles className="text-primary" size={22} />}
            title="설명 가능한 AI 추천"
            desc="왜 이 포트폴리오인지 알려줘요"
          />
        </div>

        <div className="mt-auto pb-8 pt-10 space-y-3">
          <Link
            to="/diagnosis"
            className="block w-full text-center bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform"
          >
            3분 만에 시작하기
          </Link>
          <Link
            to="/dashboard"
            className="block w-full text-center text-muted-foreground text-sm py-2"
          >
            이미 계정이 있어요
          </Link>
        </div>
      </div>
    </PhoneShell>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 bg-surface border border-border/60 rounded-2xl p-4">
      <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-[15px]">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
