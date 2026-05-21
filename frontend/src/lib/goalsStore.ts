// Shared goals state via localStorage + custom event for cross-route sync
export type Priority = "높음" | "보통" | "낮음";

export type Goal = {
  id: string;
  emoji: string;
  title: string;
  target: number; // 만원
  saved: number;
  months: number;
  priority: Priority;
  goalType?: GoalType;
};

export type GoalType = "emergency" | "short" | "mid" | "long" | "ultraLong";

const STORAGE_KEY = "moneypilot.goals.v1";
const EVENT = "moneypilot:goals-changed";
const PRIORITIES: Priority[] = ["높음", "보통", "낮음"];
const GOAL_TYPES: GoalType[] = ["emergency", "short", "mid", "long", "ultraLong"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wholeNumber = (value: unknown, fallback: number) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
};

export const defaultGoals: Goal[] = [
  {
    id: "1",
    emoji: "🏠",
    title: "전세 보증금",
    target: 5000,
    saved: 1200,
    months: 36,
    priority: "높음",
  },
  {
    id: "2",
    emoji: "☂️",
    title: "비상금",
    target: 600,
    saved: 480,
    months: 6,
    priority: "높음",
    goalType: "emergency",
  },
  {
    id: "3",
    emoji: "✈️",
    title: "유럽 여행",
    target: 400,
    saved: 90,
    months: 12,
    priority: "보통",
  },
];

export function normalizeGoal(goal: Partial<Goal>): Goal {
  const target = clamp(wholeNumber(goal.target, 1), 1, 999999);
  const saved = clamp(wholeNumber(goal.saved, 0), 0, target);
  const months = clamp(wholeNumber(goal.months, 1), 1, 600);
  const priority = PRIORITIES.includes(goal.priority as Priority)
    ? (goal.priority as Priority)
    : "보통";
  const goalType = GOAL_TYPES.includes(goal.goalType as GoalType)
    ? (goal.goalType as GoalType)
    : undefined;
  const title =
    typeof goal.title === "string" && goal.title.trim()
      ? goal.title.trim().slice(0, 32)
      : "새 목표";
  const emoji =
    typeof goal.emoji === "string" && goal.emoji.trim() ? goal.emoji.trim().slice(0, 4) : "🎯";

  return {
    id:
      typeof goal.id === "string" && goal.id
        ? goal.id
        : (globalThis.crypto?.randomUUID?.() ?? Date.now().toString()),
    emoji,
    title,
    target,
    saved,
    months,
    priority,
    ...(goalType ? { goalType } : {}),
  };
}

function parseGoals(value: unknown): Goal[] {
  if (!Array.isArray(value)) return defaultGoals;
  const goals = value.map((goal) => normalizeGoal(goal as Partial<Goal>));
  return goals;
}

export function loadGoals(): Goal[] {
  if (typeof window === "undefined") return defaultGoals;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultGoals;
    return parseGoals(JSON.parse(raw));
  } catch {
    return defaultGoals;
  }
}

export function saveGoals(goals: Goal[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals.map(normalizeGoal)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeGoals(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

// Infer goal type from title + months when not explicitly set
export function inferGoalType(goal: Goal): GoalType {
  if (goal.goalType) return goal.goalType;
  const t = goal.title.toLowerCase();
  if (t.includes("비상") || t.includes("emergency")) return "emergency";
  if (goal.months >= 180) return "ultraLong"; // 15년+
  if (goal.months >= 60) return "long"; // 5년+
  if (goal.months >= 24) return "mid"; // 2년+
  return "short";
}
