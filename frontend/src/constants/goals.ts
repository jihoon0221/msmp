import type { GoalOption } from "../types/domain";

export const goalOptions: GoalOption[] = [
  { value: "jeonse", label: "전세 임차보증금 마련", shortLabel: "전세 보증금" },
  { value: "seed", label: "1억 청년 종잣돈 모으기", shortLabel: "1억 종잣돈" },
  { value: "car", label: "첫 생애 차량 구매 자금", shortLabel: "차량 구매 자금" },
  { value: "wedding", label: "결혼 준비 자금", shortLabel: "결혼 준비 자금" },
];

export const getGoalLabel = (goalType: GoalOption["value"]) =>
  goalOptions.find((goal) => goal.value === goalType)?.shortLabel ?? "재무 목표";

