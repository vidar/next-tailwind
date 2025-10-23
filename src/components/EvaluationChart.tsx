"use client";

import { useMemo } from "react";

interface Move {
  evaluation?: number;
  classification?: string;
}

interface EvaluationChartProps {
  moves: Move[];
  currentMoveIndex?: number;
  height?: number;
}

export function EvaluationChart({
  moves,
  currentMoveIndex = 0,
  height = 200,
}: EvaluationChartProps) {
  // Calculate chart points
  const chartData = useMemo(() => {
    if (!moves || moves.length === 0) return [];

    // Add initial position at 0
    const evaluations = [0, ...moves.map((m) => m.evaluation ?? 0)];

    // Clamp evaluations between -1000 and 1000 (centipawns)
    const clampedEvals = evaluations.map((e) =>
      Math.max(-1000, Math.min(1000, e))
    );

    return clampedEvals;
  }, [moves]);

  // Get move classification colors
  const getMoveColor = (moveIndex: number) => {
    if (moveIndex === 0) return null; // Starting position
    const move = moves[moveIndex - 1];
    const classification = move?.classification?.toLowerCase();

    switch (classification) {
      case "blunder":
        return "#ef4444"; // red-500
      case "mistake":
        return "#f97316"; // orange-500
      case "inaccuracy":
        return "#f59e0b"; // amber-500
      case "good":
        return "#84cc16"; // lime-500
      case "excellent":
      case "best":
        return "#22c55e"; // green-500
      case "brilliant":
        return "#06b6d4"; // cyan-500
      default:
        return "#6b7280"; // gray-500
    }
  };

  // Convert evaluation to Y coordinate (percentage)
  const evalToY = (evaluation: number) => {
    // Map -1000 to 1000 -> 100% to 0%
    return ((1000 - evaluation) / 2000) * 100;
  };

  // Generate SVG path
  const generatePath = () => {
    if (chartData.length === 0) return "";

    const width = 100; // Use percentage
    const stepX = width / (chartData.length - 1 || 1);

    let path = `M 0,${evalToY(chartData[0])}`;

    for (let i = 1; i < chartData.length; i++) {
      const x = i * stepX;
      const y = evalToY(chartData[i]);
      path += ` L ${x},${y}`;
    }

    return path;
  };

  // Generate points for move markers
  const generatePoints = () => {
    if (chartData.length === 0) return [];

    const width = 100;
    const stepX = width / (chartData.length - 1 || 1);

    return chartData.map((evaluation, index) => ({
      x: index * stepX,
      y: evalToY(evaluation),
      evaluation,
      moveIndex: index,
      color: getMoveColor(index),
    }));
  };

  const points = generatePoints();
  const path = generatePath();

  if (chartData.length === 0) {
    return (
      <div
        className="bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400"
        style={{ height: `${height}px` }}
      >
        No evaluation data available
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
      <div className="relative" style={{ height: `${height}px` }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Center line (0.0 evaluation) */}
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="currentColor"
            strokeWidth="0.2"
            className="text-gray-400 dark:text-gray-600"
            vectorEffect="non-scaling-stroke"
          />

          {/* Advantage zones */}
          <rect
            x="0"
            y="0"
            width="100"
            height="50"
            fill="currentColor"
            className="text-gray-200 dark:text-gray-700"
            opacity="0.3"
          />
          <rect
            x="0"
            y="50"
            width="100"
            height="50"
            fill="currentColor"
            className="text-gray-300 dark:text-gray-600"
            opacity="0.3"
          />

          {/* Evaluation line */}
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-gray-700 dark:text-gray-300"
            vectorEffect="non-scaling-stroke"
          />

          {/* Move points */}
          {points.map((point, index) => {
            const isCurrentMove = index === currentMoveIndex;
            const radius = isCurrentMove ? 1.5 : point.color ? 1 : 0.5;

            return (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  fill={point.color || "#6b7280"}
                  stroke={isCurrentMove ? "#fff" : "none"}
                  strokeWidth={isCurrentMove ? "0.3" : "0"}
                  vectorEffect="non-scaling-stroke"
                  className={isCurrentMove ? "drop-shadow-lg" : ""}
                />
                {/* Tooltip on hover would go here */}
              </g>
            );
          })}
        </svg>

        {/* Labels */}
        <div className="absolute top-0 left-0 text-xs text-gray-600 dark:text-gray-400 font-mono">
          +10
        </div>
        <div className="absolute top-1/2 left-0 -translate-y-1/2 text-xs text-gray-600 dark:text-gray-400 font-mono">
          0.0
        </div>
        <div className="absolute bottom-0 left-0 text-xs text-gray-600 dark:text-gray-400 font-mono">
          -10
        </div>

        {/* Move number at current position */}
        {currentMoveIndex > 0 && points[currentMoveIndex] && (
          <div
            className="absolute text-xs font-semibold text-blue-600 dark:text-blue-400"
            style={{
              left: `${points[currentMoveIndex].x}%`,
              bottom: "-24px",
              transform: "translateX(-50%)",
            }}
          >
            Move {currentMoveIndex}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Brilliant</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Best/Excellent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-lime-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Good</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Inaccuracy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Mistake</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Blunder</span>
        </div>
      </div>
    </div>
  );
}
