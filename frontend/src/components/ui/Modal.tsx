import { X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Button } from "./Button";

type ModalProps = PropsWithChildren<{
  title: string;
  open: boolean;
  onClose: () => void;
  link?: string;
}>;

export function Modal({ title, open, onClose, link, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="no-scrollbar max-h-[85%] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-100">{title}</h3>
          <button
            type="button"
            aria-label="닫기"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="mb-5 space-y-3 text-xs leading-relaxed text-slate-300">{children}</div>
        <div className="flex flex-col gap-2">
          {link ? (
            <a
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-700"
              href={link}
              target="_blank"
              rel="noreferrer"
            >
              외부 링크로 이동
            </a>
          ) : null}
          <Button className="w-full" onClick={onClose}>
            확인 및 닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

