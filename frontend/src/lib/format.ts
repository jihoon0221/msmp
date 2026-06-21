export const formatManwon = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(value));

export const formatWon = (value: number) =>
  `${new Intl.NumberFormat("ko-KR").format(Math.round(value))}원`;

export const formatPercent = (value: number, digits = 1) =>
  `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
