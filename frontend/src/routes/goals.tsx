import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PhoneShell, PageHeader } from "@/components/PhoneShell";
import {
  Plus,
  Home,
  Umbrella,
  Plane,
  Sparkles,
  Heart,
  Car,
  GraduationCap,
  PiggyBank,
  Rocket,
  BookOpen,
  Baby,
  Gift,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  loadGoals,
  saveGoals,
  subscribeGoals,
  type Goal,
  type Priority,
  type GoalType,
} from "@/lib/goalsStore";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "재무 목표 — 머니파일럿" },
      { name: "description", content: "내 목표를 설정하고 매월 필요한 저축액을 계산해보세요." },
    ],
  }),
  component: Goals,
});

export function Goals() {
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);

  useEffect(() => {
    return subscribeGoals(() => setGoals(loadGoals()));
  }, []);

  const update = (next: Goal[]) => {
    setGoals(next);
    saveGoals(next);
  };

  const handleEdit = (updated: Goal) => {
    update(goals.map((g) => (g.id === updated.id ? updated : g)));
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    update(goals.filter((g) => g.id !== id));
    setConfirmDelete(null);
  };

  return (
    <PhoneShell>
      <PageHeader title="나의 목표" subtitle="목표가 명확할수록 계획도 명확해져요" />

      <div className="px-5 mt-2 space-y-3">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            onEdit={() => setEditing(g)}
            onDelete={() => setConfirmDelete(g)}
          />
        ))}

        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl py-5 text-muted-foreground font-medium active:bg-secondary"
        >
          <Plus size={18} />새 목표 추가하기
        </button>

        <Link
          to="/recommendation"
          className="flex items-center gap-3 bg-primary-soft border border-primary/20 rounded-2xl p-4 mt-2"
        >
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">목표 기반 AI 추천 받기</p>
            <p className="text-xs text-muted-foreground">목표에 맞춘 자산 배분을 알려드려요</p>
          </div>
        </Link>
      </div>

      {open && (
        <NewGoalSheet
          onClose={() => setOpen(false)}
          onAdd={(g) => {
            update([g, ...goals]);
            setOpen(false);
          }}
        />
      )}
      {editing && (
        <EditGoalSheet goal={editing} onClose={() => setEditing(null)} onSave={handleEdit} />
      )}
      {confirmDelete && (
        <ConfirmDeleteDialog
          goal={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete.id)}
        />
      )}
    </PhoneShell>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
  const remain = Math.max(0, goal.target - goal.saved);
  const monthly = Math.ceil(remain / goal.months);
  const prColor =
    goal.priority === "높음"
      ? "bg-primary-soft text-primary"
      : goal.priority === "보통"
        ? "bg-secondary text-secondary-foreground"
        : "bg-secondary text-muted-foreground";

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-2xl">
            {goal.emoji}
          </div>
          <div>
            <p className="font-semibold">{goal.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {goal.months}개월 안에 {goal.target.toLocaleString()}만원
            </p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${prColor}`}>
          {goal.priority}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-semibold text-primary">{pct}%</span>
          <span className="text-xs text-muted-foreground">
            {goal.saved.toLocaleString()} / {goal.target.toLocaleString()}만원
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-[oklch(0.7_0.18_200)] rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">매월 필요 저축액</span>
        <span className="font-bold">{monthly.toLocaleString()}만원</span>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold active:bg-secondary/70"
        >
          <Pencil size={14} />
          수정
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold active:bg-destructive/20"
        >
          <Trash2 size={14} />
          삭제
        </button>
      </div>
    </div>
  );
}

function EditGoalSheet({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal;
  onClose: () => void;
  onSave: (g: Goal) => void;
}) {
  const [emoji, setEmoji] = useState(goal.emoji);
  const [title, setTitle] = useState(goal.title);
  const [target, setTarget] = useState(String(goal.target));
  const [saved, setSaved] = useState(String(goal.saved));
  const [months, setMonths] = useState(String(goal.months));
  const [priority, setPriority] = useState<Priority>(goal.priority);

  const emojiOptions = ["🏠", "☂️", "✈️", "💍", "🚗", "🎓", "👵", "🚀", "📚", "👶", "🎁", "⭐"];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/40" />
      <div
        className="relative w-full max-w-[420px] bg-surface rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-5" />
        <h2 className="text-xl font-bold">목표 수정하기</h2>
        <p className="text-sm text-muted-foreground mt-1">목표 정보를 자유롭게 변경하세요</p>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">아이콘</p>
          <div className="grid grid-cols-6 gap-2">
            {emojiOptions.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`aspect-square rounded-xl border text-2xl flex items-center justify-center ${
                  emoji === e ? "border-primary bg-primary-soft" : "border-border bg-surface"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <SheetField label="목표명" value={title} onChange={setTitle} />
          <SheetField
            label="목표 금액 (만원)"
            value={target}
            onChange={(v) => setTarget(v.replace(/\D/g, ""))}
            numeric
          />
          <SheetField
            label="현재 모은 금액 (만원)"
            value={saved}
            onChange={(v) => setSaved(v.replace(/\D/g, ""))}
            numeric
          />
          <SheetField
            label="기간 (개월)"
            value={months}
            onChange={(v) => setMonths(v.replace(/\D/g, ""))}
            numeric
          />

          <div className="bg-secondary/50 rounded-2xl p-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">우선순위</p>
            <div className="grid grid-cols-3 gap-2">
              {(["높음", "보통", "낮음"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 rounded-xl text-sm font-medium ${
                    priority === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 bg-secondary text-secondary-foreground font-semibold py-4 rounded-2xl"
          >
            취소
          </button>
          <button
            onClick={() =>
              onSave({
                ...goal,
                emoji,
                title: title || goal.title,
                target: Number(target) || 0,
                saved: Number(saved) || 0,
                months: Number(months) || 1,
                priority,
              })
            }
            className="flex-[2] bg-primary text-primary-foreground font-semibold py-4 rounded-2xl"
          >
            변경사항 저장
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteDialog({
  goal,
  onCancel,
  onConfirm,
}: {
  goal: Goal;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-foreground/40" />
      <div
        className="relative w-full max-w-[360px] bg-surface rounded-3xl p-6 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive mx-auto mb-3">
          <Trash2 size={24} />
        </div>
        <h3 className="text-lg font-bold text-center">목표를 삭제할까요?</h3>
        <p className="text-sm text-muted-foreground text-center mt-1.5">
          <span className="font-semibold">
            {goal.emoji} {goal.title}
          </span>{" "}
          목표가 영구 삭제됩니다.
          <br />이 작업은 되돌릴 수 없어요.
        </p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 bg-secondary text-secondary-foreground font-semibold py-3 rounded-2xl"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-destructive text-destructive-foreground font-semibold py-3 rounded-2xl"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

type Preset = {
  emoji: string;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  defaultTarget: number;
  defaultMonths: number;
  defaultPriority: Priority;
  allocationHint: string;
  goalType: GoalType;
};

const presets: Preset[] = [
  {
    emoji: "🏠",
    title: "주택 자금",
    icon: Home,
    defaultTarget: 5000,
    defaultMonths: 36,
    defaultPriority: "높음",
    allocationHint: "장기 목표 · 주식ETF 45% 채권 25% 예적금 20% 현금 10%",
    goalType: "long",
  },
  {
    emoji: "☂️",
    title: "비상금",
    icon: Umbrella,
    defaultTarget: 600,
    defaultMonths: 6,
    defaultPriority: "높음",
    allocationHint: "초저위험 · 예적금 80% 현금 20%",
    goalType: "emergency",
  },
  {
    emoji: "✈️",
    title: "여행",
    icon: Plane,
    defaultTarget: 400,
    defaultMonths: 12,
    defaultPriority: "보통",
    allocationHint: "단기 안정 · 예적금 60% 채권 30% 현금 10%",
    goalType: "short",
  },
  {
    emoji: "💍",
    title: "결혼 자금",
    icon: Heart,
    defaultTarget: 3000,
    defaultMonths: 24,
    defaultPriority: "높음",
    allocationHint: "중기 균형 · 채권 35% 예적금 30% 주식 25% 현금 10%",
    goalType: "mid",
  },
  {
    emoji: "🚗",
    title: "자동차",
    icon: Car,
    defaultTarget: 2500,
    defaultMonths: 18,
    defaultPriority: "보통",
    allocationHint: "단기~중기 · 예적금 60% 채권 30% 현금 10%",
    goalType: "short",
  },
  {
    emoji: "🎓",
    title: "학자금",
    icon: GraduationCap,
    defaultTarget: 2000,
    defaultMonths: 24,
    defaultPriority: "보통",
    allocationHint: "중기 균형 · 예적금 30% 채권 35% 주식 25% 현금 10%",
    goalType: "mid",
  },
  {
    emoji: "👵",
    title: "노후 자금",
    icon: PiggyBank,
    defaultTarget: 30000,
    defaultMonths: 240,
    defaultPriority: "보통",
    allocationHint: "초장기 · 주식ETF 70% 채권 25% 예적금 5%",
    goalType: "ultraLong",
  },
  {
    emoji: "🚀",
    title: "창업 자금",
    icon: Rocket,
    defaultTarget: 5000,
    defaultMonths: 36,
    defaultPriority: "보통",
    allocationHint: "장기 · 주식 45% 채권 25% 예적금 20% 현금 10%",
    goalType: "long",
  },
  {
    emoji: "📚",
    title: "자기계발",
    icon: BookOpen,
    defaultTarget: 300,
    defaultMonths: 12,
    defaultPriority: "낮음",
    allocationHint: "단기 · 예적금 60% 채권 30% 현금 10%",
    goalType: "short",
  },
  {
    emoji: "👶",
    title: "출산 / 육아",
    icon: Baby,
    defaultTarget: 1500,
    defaultMonths: 18,
    defaultPriority: "높음",
    allocationHint: "단기~중기 · 예적금 60% 채권 30% 현금 10%",
    goalType: "short",
  },
  {
    emoji: "🎁",
    title: "선물 / 이벤트",
    icon: Gift,
    defaultTarget: 200,
    defaultMonths: 6,
    defaultPriority: "낮음",
    allocationHint: "초단기 · 예적금 80% 현금 20%",
    goalType: "emergency",
  },
];

function NewGoalSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (g: Goal) => void }) {
  const [emoji, setEmoji] = useState("🏠");
  const [title, setTitle] = useState("주택 자금");
  const [target, setTarget] = useState("5000");
  const [months, setMonths] = useState("36");
  const [priority, setPriority] = useState<Priority>("높음");
  const [hint, setHint] = useState(presets[0].allocationHint);
  const [goalType, setGoalType] = useState<GoalType>(presets[0].goalType);
  const [isCustom, setIsCustom] = useState(false);

  const selectPreset = (p: Preset) => {
    setEmoji(p.emoji);
    setTitle(p.title);
    setTarget(String(p.defaultTarget));
    setMonths(String(p.defaultMonths));
    setPriority(p.defaultPriority);
    setHint(p.allocationHint);
    setGoalType(p.goalType);
    setIsCustom(false);
  };

  const selectCustom = () => {
    setEmoji("⭐");
    setTitle("");
    setTarget("1000");
    setMonths("12");
    setPriority("보통");
    setHint("기간을 기준으로 AI가 자동 분류해 자산배분을 제안해드려요");
    setIsCustom(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/40" />
      <div
        className="relative w-full max-w-[420px] bg-surface rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-5" />
        <h2 className="text-xl font-bold">새 목표 만들기</h2>
        <p className="text-sm text-muted-foreground mt-1">자주 쓰는 목표 중에 골라보세요</p>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {presets.map((p) => (
            <button
              key={p.title}
              onClick={() => selectPreset(p)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all ${
                title === p.title && !isCustom
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-surface"
              }`}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-[11px] font-medium text-center px-1 leading-tight">
                {p.title}
              </span>
            </button>
          ))}
          <button
            onClick={selectCustom}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-dashed transition-all ${
              isCustom ? "border-primary bg-primary-soft" : "border-border bg-surface"
            }`}
          >
            <span className="text-2xl">✨</span>
            <span className="text-[11px] font-medium">직접 입력</span>
          </button>
        </div>

        <div className="space-y-3 mt-4">
          <SheetField label="목표명" value={title} onChange={setTitle} />
          <SheetField
            label="목표 금액 (만원)"
            value={target}
            onChange={(v) => setTarget(v.replace(/\D/g, ""))}
            numeric
          />
          <SheetField
            label="기간 (개월)"
            value={months}
            onChange={(v) => setMonths(v.replace(/\D/g, ""))}
            numeric
          />

          <div className="bg-secondary/50 rounded-2xl p-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">우선순위</p>
            <div className="grid grid-cols-3 gap-2">
              {(["높음", "보통", "낮음"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 rounded-xl text-sm font-medium ${
                    priority === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-primary-soft border border-primary/20 rounded-2xl p-3 flex gap-2.5">
            <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-primary mb-0.5">AI 추천 자산배분</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            onAdd({
              id: Date.now().toString(),
              emoji,
              title: title || "새 목표",
              target: Number(target) || 0,
              saved: 0,
              months: Number(months) || 1,
              priority,
              goalType: isCustom ? undefined : goalType,
            })
          }
          className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl mt-5"
        >
          목표 추가하기
        </button>
      </div>
    </div>
  );
}

function SheetField({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="block bg-secondary/50 rounded-2xl px-4 py-3">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <input
        inputMode={numeric ? "numeric" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full bg-transparent text-base font-semibold outline-none mt-0.5"
      />
    </label>
  );
}
