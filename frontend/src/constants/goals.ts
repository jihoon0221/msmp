import type { GoalOption } from "../types/domain";

export const goalOptions: GoalOption[] = [
  { value: "jeonse", label: "전세보증금 마련", shortLabel: "전세 보증금" },
  { value: "seed", label: "장기 투자를 위한 시드 머니 모으기", shortLabel: "1억 종잣돈" },
  { value: "car", label: "첫 생애 차량 구매 자금", shortLabel: "차량 구매 자금" },
  { value: "wedding", label: "결혼 준비 자금", shortLabel: "결혼 준비 자금" },
  { value: "other", label: "기타", shortLabel: "기타" },
];

export const getGoalLabel = (goalType: GoalOption["value"]) =>
  goalOptions.find((goal) => goal.value === goalType)?.shortLabel ?? "재무 목표";

