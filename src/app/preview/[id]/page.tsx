"use client";

import { Player } from "@remotion/player";
import type { NextPage } from "next";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import {
  ChessGameProps,
  CHESS_VIDEO_FPS,
  CHESS_VIDEO_HEIGHT,
  CHESS_VIDEO_WIDTH,
  CHESS_SECONDS_PER_MOVE,
} from "../../../../types/constants";
import { ChessGameWalkthrough } from "../../../remotion/ChessGame/ChessGameWalkthrough";
import { Chess } from "chess.js";

interface ChessAnalysis {
  id: string;
  pgn: string;
  game_data: any;
  analysis_config: {
    depth: number;
    find_alternatives: boolean;
  };
  analysis_results: any;
  status: string;
  completed_at: string | null;
}

const ChessVideoPreview: NextPage = () => {
  const params = useParams();
  const id = params.id as string;

  const [analysis, setAnalysis] = useState<ChessAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAnalysis();
  }, [id]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/analyses/${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch analysis");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const extractGameInfo = (pgn: string) => {
    const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
    const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);
    const resultMatch = pgn.match(/\[Result "([^"]+)"\]/);
    const dateMatch = pgn.match(/\[Date "([^"]+)"\]/);

    return {
      white: whiteMatch ? whiteMatch[1] : "Unknown",
      black: blackMatch ? blackMatch[1] : "Unknown",
      result: resultMatch ? resultMatch[1] : "*",
      date: dateMatch ? dateMatch[1] : "Unknown",
    };
  };

  const calculateDuration = (pgn: string): number => {
    try {
      const game = new Chess();
      game.loadPgn(pgn);
      const moves = game.history();
      return moves.length * CHESS_VIDEO_FPS * CHESS_SECONDS_PER_MOVE;
    } catch {
      return 60 * CHESS_VIDEO_FPS;
    }
  };

  const inputProps: z.infer<typeof ChessGameProps> | null = useMemo(() => {
    if (!analysis) return null;

    const gameInfo = extractGameInfo(analysis.pgn);

    return {
      pgn: analysis.pgn,
      analysisResults: analysis.analysis_results,
      gameInfo,
    };
  }, [analysis]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="text-xl text-gray-600 dark:text-gray-400">
              Loading video preview...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis || !inputProps) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error || "Analysis not found"}</p>
            <Link
              href="/analyzed_games"
              className="inline-block mt-4 text-blue-500 hover:text-blue-600 underline"
            >
              Back to Analyzed Games
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const durationInFrames = calculateDuration(analysis.pgn);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Video Preview</h1>
          <div className="flex gap-4">
            <Link
              href={`/analyzed_games/${id}`}
              className="text-blue-500 hover:text-blue-600 underline"
            >
              Back to Game
            </Link>
            <Link
              href="/analyzed_games"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              All Games
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            {inputProps.gameInfo.white} vs {inputProps.gameInfo.black}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {inputProps.gameInfo.result} • {inputProps.gameInfo.date}
          </p>

          <div className="overflow-hidden rounded-lg shadow-2xl">
            <Player
              component={ChessGameWalkthrough}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={CHESS_VIDEO_FPS}
              compositionHeight={CHESS_VIDEO_HEIGHT}
              compositionWidth={CHESS_VIDEO_WIDTH}
              style={{
                width: "100%",
                maxHeight: "80vh",
              }}
              controls
              autoPlay={false}
              loop
            />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
            Video Information
          </h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-700 dark:text-gray-300">
                Resolution:
              </dt>
              <dd className="text-gray-600 dark:text-gray-400">
                {CHESS_VIDEO_WIDTH} × {CHESS_VIDEO_HEIGHT} (Portrait)
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700 dark:text-gray-300">
                Duration:
              </dt>
              <dd className="text-gray-600 dark:text-gray-400">
                {Math.round(durationInFrames / CHESS_VIDEO_FPS)} seconds
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700 dark:text-gray-300">
                Frame Rate:
              </dt>
              <dd className="text-gray-600 dark:text-gray-400">
                {CHESS_VIDEO_FPS} FPS
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700 dark:text-gray-300">
                Format:
              </dt>
              <dd className="text-gray-600 dark:text-gray-400">
                MP4 (H.264)
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default ChessVideoPreview;
