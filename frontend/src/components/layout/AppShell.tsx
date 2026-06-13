import { BatteryMedium, ChartNoAxesColumn, Compass, Home, Send, User, Wifi } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useClock } from "../../hooks/useClock";
import type { AppTab } from "../../types/domain";

type AppShellProps = PropsWithChildren<{
  activeTab: AppTab;
  userEmail?: string;
  onTabChange: (tab: AppTab) => void;
}>;

const navItems = [
  { tab: "home" as const, label: "홈", icon: Home },
  { tab: "assets" as const, label: "자산현황", icon: ChartNoAxesColumn },
  { tab: "explore" as const, label: "AI탐색", icon: Compass },
  { tab: "my" as const, label: "MY", icon: User },
];

export function AppShell({ children, activeTab, userEmail, onTabChange }: AppShellProps) {
  const time = useClock();
  const avatarLabel = getAvatarLabel(userEmail);

  return (
    <div className="flex min-h-screen items-center justify-center px-3 py-4 sm:py-8">
      <div className="relative flex h-[880px] w-full max-w-md flex-col overflow-hidden rounded-3xl border-[10px] border-slate-800 bg-white shadow-2xl">
        <div className="absolute inset-x-0 top-0 z-50 flex h-6 items-center justify-between bg-slate-800 px-6 text-[10px] text-white">
          <span>{time}</span>
          <div className="absolute left-1/2 top-0 flex h-4 w-24 -translate-x-1/2 items-center justify-center rounded-b-xl bg-slate-800">
            <span className="mr-1 block h-2.5 w-2.5 rounded-full bg-slate-900" />
            <span className="block h-1 w-8 rounded-full bg-slate-700" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-emerald-400">SECURE</span>
            <Wifi size={12} />
            <BatteryMedium size={14} />
          </div>
        </div>

        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 pb-3 pt-9">
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Send className="text-blue-600" size={20} />
            Money Pilot
          </h1>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold uppercase text-blue-600"
            title={userEmail}
          >
            {avatarLabel}
          </div>
        </header>

        {children}

        <nav className="absolute bottom-0 z-10 flex w-full justify-between border-t border-slate-200 bg-white px-6 py-2">
          {navItems.map(({ tab, label, icon: Icon }) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`flex min-w-12 flex-col items-center gap-1 transition-colors ${
                  active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                }`}
                onClick={() => onTabChange(tab)}
              >
                <Icon size={18} />
                <span className="text-[9px] font-bold">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function getAvatarLabel(userEmail?: string) {
  if (!userEmail) return "MP";
  return userEmail.trim().slice(0, 2) || "MP";
}
