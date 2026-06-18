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
      type: "pie",
      data: {
        labels: allocations.map((item) => item.label),
        datasets: [
          {
            data: allocations.map((item) => item.weight),
            backgroundColor: allocations.map((item) => item.color),
            borderColor: "#f8fafc",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
    });

    return () => chart.destroy();
  }, [allocations]);

  return (
    <div className="relative flex items-center justify-center h-full w-full">
      <canvas ref={canvasRef} aria-label="포트폴리오 자산 배분 차트" className="h-full w-full" />
    </div>
  );
}

