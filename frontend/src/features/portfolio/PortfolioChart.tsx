import Chart from "chart.js/auto";
import { useEffect, useRef } from "react";
import type { PortfolioAllocation } from "../../types/domain";

type PortfolioChartProps = {
  allocations: PortfolioAllocation[];
  expectedReturnPercent?: number;
};

export function PortfolioChart({ allocations, expectedReturnPercent }: PortfolioChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
    });

    return () => chart.destroy();
  }, [allocations]);

  // Calculate label positions based on segment angles
  const getLabelPosition = (index: number) => {
    const totalWeight = allocations.reduce((sum, item) => sum + item.weight, 0);
    let cumulativeAngle = 0;

    for (let i = 0; i < index; i++) {
      cumulativeAngle += (allocations[i].weight / totalWeight) * 360;
    }

    const segmentWeight = allocations[index].weight;
    const segmentAngle = (segmentWeight / totalWeight) * 360;
    const midAngle = cumulativeAngle + segmentAngle / 2;

    // Position labels around the chart at radius ~90px from center
    const radius = 85;
    const radians = (midAngle - 90) * (Math.PI / 180);
    const x = Math.cos(radians) * radius;
    const y = Math.sin(radians) * radius;

    return { x, y, midAngle };
  };

  return (
    <div ref={containerRef} className="relative flex items-center justify-center h-full w-full">
      <canvas ref={canvasRef} aria-label="포트폴리오 자산 배분 차트" className="block h-full w-full" />
      
      {/* Center display - Expected return */}
      {expectedReturnPercent !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-3xl font-black text-slate-900">{expectedReturnPercent.toFixed(1)}%</div>
            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">기대수익률</div>
          </div>
        </div>
      )}
      
      {/* Label overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg className="absolute w-full h-full" viewBox="0 0 200 200" style={{ maxWidth: "100%", maxHeight: "100%" }}>
          {allocations.map((allocation, index) => {
            const { x, y } = getLabelPosition(index);
            const radians = Math.atan2(y, x);
            
            // Calculate label position based on direction
            const dx = Math.cos(radians);
            const dy = Math.sin(radians);
            
            // Adjust radius based on direction to avoid overlap
            let labelRadius = 130;
            // Top area - push further up
            if (dy < -0.3) labelRadius = 150;
            // Bottom area - push further down
            else if (dy > 0.3) labelRadius = 150;
            // Left area - push further left
            else if (dx < -0.3) labelRadius = 145;
            // Right area - push further right
            else if (dx > 0.3) labelRadius = 145;
            
            const labelX = Math.cos(radians) * labelRadius;
            const labelY = Math.sin(radians) * labelRadius;

            // Line from chart edge to label - moved outside
            const lineStartRadius = 70;
            const lineStartX = Math.cos(radians) * lineStartRadius;
            const lineStartY = Math.sin(radians) * lineStartRadius;

            return (
              <g key={index}>
                <line
                  x1={100 + lineStartX}
                  y1={100 + lineStartY}
                  x2={100 + labelX}
                  y2={100 + labelY}
                  stroke={allocation.color}
                  strokeWidth="1.2"
                  opacity="0.7"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Text labels */}
        <div className="absolute w-full h-full">
          {allocations.map((allocation, index) => {
            const { x, y } = getLabelPosition(index);
            const radians = Math.atan2(y, x);
            
            // Calculate label position based on direction
            const dx = Math.cos(radians);
            const dy = Math.sin(radians);
            
            // Adjust radius based on direction to avoid overlap
            let labelRadius = 130;
            // Top area - push further up
            if (dy < -0.3) labelRadius = 150;
            // Bottom area - push further down
            else if (dy > 0.3) labelRadius = 150;
            // Left area - push further left
            else if (dx < -0.3) labelRadius = 145;
            // Right area - push further right
            else if (dx > 0.3) labelRadius = 145;
            
            const labelX = Math.cos(radians) * labelRadius;
            const labelY = Math.sin(radians) * labelRadius;

            // Convert to percentage of container
            const containerSize = 160; // Approximate chart size
            const percentX = ((labelX / 100) * containerSize) / 2;
            const percentY = ((labelY / 100) * containerSize) / 2;

            return (
              <div
                key={index}
                className="absolute whitespace-nowrap text-center"
                style={{
                  left: `calc(50% + ${percentX}px)`,
                  top: `calc(50% + ${percentY}px)`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="text-[10px] font-semibold text-slate-700">{allocation.label}</div>
                <div className="text-[10px] font-bold text-slate-800">{allocation.weight}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

