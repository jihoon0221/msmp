import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneShell, PageHeader } from "@/components/PhoneShell";
import { ChevronRight, Settings, Bell, ShieldCheck, HelpCircle, LogOut } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "내 정보 — 머니파일럿" },
      { name: "description", content: "프로필 및 앱 설정." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // 프로토타입: 실제 세션 정리 로직이 들어갈 자리
    navigate({ to: "/" });
  };

  return (
    <PhoneShell>
      <PageHeader title="내 정보" />

      <div className="px-5">
        <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[oklch(0.55_0.22_265)] text-primary-foreground flex items-center justify-center font-bold text-xl">
            전
          </div>
          <div className="flex-1">
            <p className="font-bold">전동민</p>
            <p className="text-xs text-muted-foreground mt-0.5">28세 · 사회초년생</p>
          </div>
          <Link to="/diagnosis" className="text-xs font-semibold text-primary">
            정보 수정
          </Link>
        </div>

        <div className="mt-4 bg-surface border border-border rounded-2xl divide-y divide-border">
          <Row icon={<Bell size={18} />} label="알림 설정" />
          <Row icon={<ShieldCheck size={18} />} label="보안 및 인증" />
          <Row icon={<Settings size={18} />} label="앱 환경 설정" />
          <Row icon={<HelpCircle size={18} />} label="도움말" />
          <Row icon={<LogOut size={18} />} label="로그아웃" danger onClick={handleLogout} />
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          머니파일럿 v1.0.0 · 프로토타입
        </p>
      </div>
    </PhoneShell>
  );
}

function Row({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-4 active:bg-secondary">
      <span className={danger ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
      <span className={`flex-1 text-left text-sm font-medium ${danger ? "text-destructive" : ""}`}>
        {label}
      </span>
      {!danger && <ChevronRight size={16} className="text-muted-foreground" />}
    </button>
  );
}
