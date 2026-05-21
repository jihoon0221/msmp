import { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Home, Target, Sparkles, User } from "lucide-react";

export function PhoneShell({
  children,
  showTabs = true,
}: {
  children: ReactNode;
  showTabs?: boolean;
}) {
  return (
    <div className="phone-frame flex flex-col">
      <div className="flex-1 flex flex-col pb-24">{children}</div>
      {showTabs && <BottomTabs />}
    </div>
  );
}

function BottomTabs() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/dashboard", label: "홈", icon: Home },
    { to: "/goals", label: "목표", icon: Target },
    { to: "/recommendation", label: "AI 추천", icon: Sparkles },
    { to: "/profile", label: "내 정보", icon: User },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-surface/95 backdrop-blur border-t border-border">
      <div className="grid grid-cols-4 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active =
            pathname === to || (to === "/recommendation" && pathname === "/explanation");
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back?: string;
}) {
  return (
    <header className="px-5 pt-6 pb-3">
      {back && (
        <Link to={back} className="inline-flex text-muted-foreground text-sm mb-2">
          ← 뒤로
        </Link>
      )}
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </header>
  );
}
