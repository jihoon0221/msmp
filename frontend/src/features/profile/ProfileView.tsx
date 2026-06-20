import { ChevronRight, Gavel, Link, LogOut, ShieldUser, Target } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import type { ModalContent, PortfolioModel } from "../../types/domain";

type ProfileViewProps = {
  model: PortfolioModel;
  userEmail?: string;
  onResetGoal: () => void;
  onSignOut: () => void | Promise<void>;
};

const menuItems: Array<{ icon: ReactNode; title: string; body: string }> = [
  {
    icon: <ShieldUser size={16} />,
    title: "개인정보 및 보안 관리",
    body: "개인정보보호법과 신용정보법에 맞춰 마이데이터 연결, 인증수단, 전송요구 내역을 조회하고 철회하는 화면으로 확장합니다.",
  },
  {
    icon: <Link size={16} />,
    title: "마이데이터 API 연동 목록",
    body: "은행, 증권, 카드사의 계좌/거래 데이터를 Supabase에 저장하지 않고 필요한 범위만 동의 기반으로 조회하는 구조를 권장합니다.",
  },
  {
    icon: <Gavel size={16} />,
    title: "투자자 공시 및 약관 도움말",
    body: "AI 추천 모델의 규제 지위, 투자 위험, 상품 설명서 열람, 투자자 보호 문구를 별도 약관 화면으로 분리해야 합니다.",
  },
];

export function ProfileView({ model, userEmail, onResetGoal, onSignOut }: ProfileViewProps) {
  const [modal, setModal] = useState<ModalContent | null>(null);
  const avatarLabel = getAvatarLabel(userEmail);

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-950 px-5 py-5 pb-24">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-sm font-bold uppercase text-white">
          {avatarLabel}
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">{userEmail ?? "로그인 사용자"}</h2>
          <p className="text-xs text-slate-400">Supabase Auth 계정 · {model.label} 투자자</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-sm">
        {menuItems.map((item) => (
          <button
            key={item.title}
            type="button"
            className="flex w-full items-center justify-between border-b border-slate-800 p-3.5 text-left transition-colors last:border-b-0 hover:bg-slate-800"
            onClick={() => setModal({ title: item.title, body: item.body })}
          >
            <span className="flex items-center gap-2.5 text-xs font-bold text-slate-200">
              <span className="text-slate-400">{item.icon}</span>
              {item.title}
            </span>
            <ChevronRight size={14} className="text-slate-400" />
          </button>
        ))}
        <button
          type="button"
          className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-slate-800"
          onClick={onResetGoal}
        >
          <span className="flex items-center gap-2.5 text-xs font-bold text-slate-200">
            <Target size={16} className="text-slate-400" />
            재무목표 / 자산현황 다시 수정하기
          </span>
          <ChevronRight size={14} className="text-slate-400" />
        </button>
      </div>

      <Button className="mt-5 w-full" variant="ghost" onClick={() => void onSignOut()}>
        <LogOut size={15} />
        로그아웃
      </Button>

      <Modal open={Boolean(modal)} title={modal?.title ?? ""} onClose={() => setModal(null)}>
        <p>{modal?.body}</p>
      </Modal>
    </main>
  );
}

function getAvatarLabel(userEmail?: string) {
  if (!userEmail) return "MP";
  return userEmail.trim().slice(0, 2) || "MP";
}
