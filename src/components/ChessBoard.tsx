"use client";

import { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import { Chess } from "chess.js";
import type { Api } from "chessground/api";

interface ChessBoardProps {
  fen: string;
  evaluation?: number;
  size?: number;
  showEvaluation?: boolean;
  orientation?: "white" | "black";
}

export function ChessBoard({
  fen,
  evaluation = 0,
  size = 600,
  showEvaluation = true,
  orientation = "white",
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  useEffect(() => {
    if (boardRef.current && !cgRef.current) {
      cgRef.current = Chessground(boardRef.current, {
        viewOnly: true,
        coordinates: true,
        fen,
        orientation,
      });
    }
  }, []);

  useEffect(() => {
    if (cgRef.current) {
      const game = new Chess(fen);
      cgRef.current.set({
        fen,
        turnColor: game.turn() === "w" ? "white" : "black",
        movable: {
          color: undefined,
          free: false,
        },
      });
    }
  }, [fen]);

  const getEvaluationPercentage = (eval_score: number): number => {
    const clamped = Math.max(-1000, Math.min(1000, eval_score));
    return ((1000 - clamped) / 2000) * 100;
  };

  return (
    <div className="flex gap-4 items-start">
      {/* Evaluation Bar */}
      {showEvaluation && (
        <div className="flex flex-col items-center">
          <div
            className="w-8 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600"
            style={{ height: `${size}px` }}
          >
            <div
              className="bg-gray-800 dark:bg-white transition-all duration-300 flex items-start justify-center"
              style={{
                height: `${getEvaluationPercentage(evaluation)}%`,
              }}
            >
              <div className="text-white dark:text-gray-800 text-xs font-bold pt-1">
                {evaluation > 0
                  ? `+${(evaluation / 100).toFixed(1)}`
                  : (evaluation / 100).toFixed(1)}
              </div>
            </div>
          </div>
          <div className="text-xs mt-2 text-gray-600 dark:text-gray-400">
            Eval
          </div>
        </div>
      )}

      {/* Chess Board */}
      <div
        ref={boardRef}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          maxWidth: "100%",
        }}
      ></div>
    </div>
  );
}
