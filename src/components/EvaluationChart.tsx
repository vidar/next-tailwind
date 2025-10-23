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
  height = 240,
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
        return null;
    }
  };

  // Convert evaluation to Y coordinate (percentage)
  const evalToY = (evaluation: number) => {
    // Map -1000 to 1000 -> 100% to 0%
    return ((1000 - evaluation) / 2000) * 100;
  };

  // Generate SVG path for the area fill (white advantage)
  const generateWhiteAreaPath = () => {
    if (chartData.length === 0) return "";

    const width = 100;
    const stepX = width / (chartData.length - 1 || 1);

    // Start from bottom left at center line (50%)
    let path = `M 0,50`;

    // Draw along the evaluation line
    for (let i = 0; i < chartData.length; i++) {
      const x = i * stepX;
      const y = Math.min(50, evalToY(chartData[i])); // Only above center
      path += ` L ${x},${y}`;
    }

    // Close path back to center line
    path += ` L 100,50 Z`;

    return path;
  };

  // Generate SVG path for the area fill (black advantage)
  const generateBlackAreaPath = () => {
    if (chartData.length === 0) return "";

    const width = 100;
    const stepX = width / (chartData.length - 1 || 1);

    // Start from top left at center line (50%)
    let path = `M 0,50`;

    // Draw along the evaluation line
    for (let i = 0; i < chartData.length; i++) {
      const x = i * stepX;
      const y = Math.max(50, evalToY(chartData[i])); // Only below center
      path += ` L ${x},${y}`;
    }

    // Close path back to center line
    path += ` L 100,50 Z`;

    return path;
  };

  // Generate center line path
  const generateCenterPath = () => {
    if (chartData.length === 0) return "";

    const width = 100;
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
  const whiteAreaPath = generateWhiteAreaPath();
  const blackAreaPath = generateBlackAreaPath();
  const centerPath = generateCenterPath();

  if (chartData.length === 0) {
    return (
      <div
        className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
        style={{ height: `${height}px` }}
      >
        No evaluation data available
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Position Evaluation
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-white border border-gray-300"></div>
            <span className="text-gray-600 dark:text-gray-400">White</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-900"></div>
            <span className="text-gray-600 dark:text-gray-400">Black</span>
          </div>
        </div>
      </div>

      <div className="relative" style={{ height: `${height}px` }}>
        {/* Background SVG with areas and lines */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Horizontal grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="currentColor"
              strokeWidth="0.15"
              className={y === 50 ? "text-gray-400 dark:text-gray-600" : "text-gray-300 dark:text-gray-700"}
              vectorEffect="non-scaling-stroke"
              opacity={y === 50 ? "1" : "0.5"}
            />
          ))}

          {/* White advantage area (gradient) */}
          <defs>
            <linearGradient id="whiteGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: "#ffffff", stopOpacity: 0.8 }} />
              <stop offset="100%" style={{ stopColor: "#f3f4f6", stopOpacity: 0.3 }} />
            </linearGradient>
            <linearGradient id="blackGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: "#1f2937", stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: "#111827", stopOpacity: 0.8 }} />
            </linearGradient>
          </defs>

          {/* Area fills */}
          <path
            d={whiteAreaPath}
            fill="url(#whiteGradient)"
            className="dark:opacity-40"
          />
          <path
            d={blackAreaPath}
            fill="url(#blackGradient)"
            className="dark:opacity-60"
          />

          {/* Center evaluation line */}
          <path
            d={centerPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
            className="text-blue-600 dark:text-blue-400"
            vectorEffect="non-scaling-stroke"
            style={{ filter: 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.5))' }}
          />

          {/* Vertical line at current move */}
          {currentMoveIndex > 0 && points[currentMoveIndex] && (
            <line
              x1={points[currentMoveIndex].x}
              y1="0"
              x2={points[currentMoveIndex].x}
              y2="100"
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-blue-500 dark:text-blue-400"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1,1"
              opacity="0.5"
            />
          )}
        </svg>

        {/* Circular markers overlaid with absolute positioning */}
        {points.map((point, index) => {
          const isCurrentMove = index === currentMoveIndex;
          const hasClassification = point.color !== null;

          if (!hasClassification && !isCurrentMove) return null;

          const size = isCurrentMove ? 12 : 8;

          return (
            <div
              key={index}
              className="absolute pointer-events-none"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Outer ring for current move */}
              {isCurrentMove && (
                <div
                  className="absolute inset-0 rounded-full border-2 border-blue-500 dark:border-blue-400 animate-pulse"
                  style={{
                    width: size + 8,
                    height: size + 8,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.6,
                  }}
                />
              )}
              {/* Main circular marker */}
              <div
                className="rounded-full transition-all duration-200"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: point.color || (isCurrentMove ? "#3b82f6" : "#6b7280"),
                  border: isCurrentMove ? "2px solid #ffffff" : point.color ? "1px solid #ffffff" : "none",
                  boxShadow: hasClassification || isCurrentMove
                    ? `0 0 8px ${point.color || "#3b82f6"}66`
                    : 'none',
                }}
              />
            </div>
          );
        })}

        {/* Y-axis labels */}
        <div className="absolute top-0 -left-1 text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-1 rounded">
          +10
        </div>
        <div className="absolute top-1/2 -left-1 -translate-y-1/2 text-xs font-mono text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-1 rounded font-semibold">
          0.0
        </div>
        <div className="absolute bottom-0 -left-1 text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-1 rounded">
          -10
        </div>

        {/* Current move indicator */}
        {currentMoveIndex > 0 && points[currentMoveIndex] && (
          <div
            className="absolute text-xs font-bold px-2 py-1 rounded-full bg-blue-500 text-white shadow-lg"
            style={{
              left: `${points[currentMoveIndex].x}%`,
              bottom: "-32px",
              transform: "translateX(-50%)",
            }}
          >
            #{currentMoveIndex}
          </div>
        )}

        {/* Current evaluation badge */}
        {currentMoveIndex > 0 && points[currentMoveIndex] && (
          <div
            className="absolute text-xs font-mono font-semibold px-2 py-1 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg"
            style={{
              left: `${points[currentMoveIndex].x}%`,
              top: `${points[currentMoveIndex].y}%`,
              transform: "translate(-50%, -150%)",
            }}
          >
            {(points[currentMoveIndex].evaluation / 100).toFixed(1)}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-sm"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Brilliant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Best</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-lime-500 shadow-sm"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Good</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Inaccuracy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Mistake</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Blunder</span>
          </div>
        </div>
      </div>
    </div>
  );
}
