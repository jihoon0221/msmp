import Chart from "chart.js/auto";
import { useEffect, useRef } from "react";
import type { PortfolioAllocation } from "../../types/domain";

type PortfolioChartProps = {
  allocations: PortfolioAllocation[];
};

export function PortfolioChart({ allocations }: PortfolioChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const chart = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: allocations.map((item) => item.label),
        datasets: [
          {
            data: allocations.map((item) => item.weight),
            backgroundColor: allocations.map((item) => item.color),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.parsed}%`,
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [allocations]);

  return <canvas ref={canvasRef} aria-label="포트폴리오 자산 배분 차트" />;
}

